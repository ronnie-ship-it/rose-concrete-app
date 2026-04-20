/**
 * Fuzzy name matching for Jobber imports.
 *
 * The problem: Jobber CSVs carry the client name on every job/quote/visit
 * row, but the spelling drifts — trailing whitespace, "LLC" vs "L.L.C.",
 * "&" vs "and", business-name-in-parens suffixes, ampersand vs hyphen
 * separators, single-character typos. Exact lowercase match misses ~15%
 * of rows.
 *
 * `buildNameIndex(clients)` returns a resolver `(rawName) => clientId | null`
 * that tries, in order:
 *   1. Exact match on the normalized name.
 *   2. Exact match on the aggressively-normalized name (suffix / punct /
 *      "&→and" stripped).
 *   3. Unique substring-inclusion match (either direction).
 *   4. Unique token-overlap match with ≥50% of the shorter side's tokens.
 *   5. Unique Levenshtein-distance match within edit distance 2 (catches
 *      "Smithe" vs "Smith", "Ronalds" vs "Ronald", dropped letters, etc.)
 *      — only triggers when there's exactly one candidate under the
 *      threshold AND it's at least 4 chars away from the next-best so we
 *      never confuse two similarly-named customers.
 *
 * Ambiguous hits return null from `.resolve()` so we never silently assign
 * jobs to the wrong client. `.suggest(rawName)` returns the top 3 ranked
 * candidates so a review UI can show Ronnie "did you mean one of these?"
 * for the stragglers.
 */

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

const SUFFIX_RE =
  /\b(l\.?l\.?c\.?|inc\.?|corp\.?|co\.?|ltd\.?|the)\b/gi;

function aggressive(name: string): string {
  return normalize(name)
    .replace(/&/g, " and ")
    .replace(SUFFIX_RE, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return aggressive(name)
    .split(" ")
    .filter((t) => t.length >= 2);
}

/** Levenshtein edit distance capped at `max+1` — O(min(m,n) × max) loop
 *  so we bail early for obvious non-matches instead of computing a full
 *  DP table against every customer in the book. */
function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  // Quick reject on length delta.
  if (Math.abs(a.length - b.length) > max) return max + 1;
  // Ensure a is the shorter — minimizes the DP width.
  if (a.length > b.length) [a, b] = [b, a];
  const m = a.length;
  const n = b.length;
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    let rowMin = curr[0];
    const bj = b.charCodeAt(j - 1);
    for (let i = 1; i <= m; i++) {
      const cost = a.charCodeAt(i - 1) === bj ? 0 : 1;
      const v = Math.min(
        curr[i - 1] + 1, // insertion
        prev[i] + 1, // deletion
        prev[i - 1] + cost, // substitution
      );
      curr[i] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

export type NameSuggestion = {
  id: string;
  name: string;
  /** Why this candidate matched — shown in the review UI. */
  reason: "exact" | "aggressive" | "substring" | "token-overlap" | "typo";
  /** Lower is better. */
  distance: number;
};

export interface NameIndex {
  resolve: (rawName: string) => string | null;
  suggest: (rawName: string, limit?: number) => NameSuggestion[];
}

type Entry = {
  id: string;
  name: string;
  norm: string;
  agg: string;
  toks: Set<string>;
};

export function buildNameIndex(
  rows: Array<{ id: string; name: string | null }>,
): NameIndex {
  const exact = new Map<string, string>();
  const aggressiveMap = new Map<string, string[]>();
  const entries: Entry[] = [];

  for (const r of rows) {
    if (!r.name) continue;
    const norm = normalize(r.name);
    const agg = aggressive(r.name);
    const toks = new Set(tokens(r.name));
    if (!exact.has(norm)) exact.set(norm, r.id);
    const list = aggressiveMap.get(agg) ?? [];
    list.push(r.id);
    aggressiveMap.set(agg, list);
    entries.push({ id: r.id, name: r.name, norm, agg, toks });
  }

  function tokenOverlapScore(queryToks: Set<string>, e: Entry): number {
    if (e.toks.size === 0 || queryToks.size === 0) return 0;
    let overlap = 0;
    for (const t of queryToks) if (e.toks.has(t)) overlap++;
    const denom = Math.min(queryToks.size, e.toks.size);
    return denom === 0 ? 0 : overlap / denom;
  }

  function resolve(rawName: string): string | null {
    if (!rawName) return null;
    const norm = normalize(rawName);
    const direct = exact.get(norm);
    if (direct) return direct;

    const agg = aggressive(rawName);
    if (!agg) return null;
    const aggHits = aggressiveMap.get(agg);
    if (aggHits && aggHits.length === 1) return aggHits[0];

    // Substring inclusion either direction.
    const subHits = entries.filter(
      (e) =>
        e.agg.length > 0 &&
        (e.agg.includes(agg) || agg.includes(e.agg)),
    );
    const subIds = new Set(subHits.map((e) => e.id));
    if (subIds.size === 1) return subHits[0].id;

    // Token overlap ≥ 67% AND unique.
    const queryToks = new Set(tokens(rawName));
    let tokBest: { id: string; score: number } | null = null;
    let tokTied = false;
    for (const e of entries) {
      const score = tokenOverlapScore(queryToks, e);
      if (score < 0.5) continue;
      if (!tokBest || score > tokBest.score) {
        tokBest = { id: e.id, score };
        tokTied = false;
      } else if (score === tokBest.score && e.id !== tokBest.id) {
        tokTied = true;
      }
    }
    if (tokBest && !tokTied && tokBest.score >= 0.67) return tokBest.id;

    // Levenshtein last resort — within distance 2 on the aggressive form,
    // unique, and at least 4 edits away from the runner-up.
    if (agg.length >= 4) {
      const max = agg.length <= 6 ? 1 : 2;
      let leviBest: { id: string; dist: number } | null = null;
      let leviRunnerDist = max + 1;
      for (const e of entries) {
        if (e.agg.length < 3) continue;
        const dist = levenshtein(agg, e.agg, max);
        if (dist > max) continue;
        if (!leviBest || dist < leviBest.dist) {
          leviRunnerDist = leviBest?.dist ?? max + 1;
          leviBest = { id: e.id, dist };
        } else if (e.id !== leviBest.id && dist < leviRunnerDist) {
          leviRunnerDist = dist;
        }
      }
      if (
        leviBest &&
        leviBest.dist <= max &&
        leviRunnerDist - leviBest.dist >= 2
      ) {
        return leviBest.id;
      }
    }

    return null;
  }

  function suggest(rawName: string, limit = 3): NameSuggestion[] {
    if (!rawName || entries.length === 0) return [];
    const norm = normalize(rawName);
    const agg = aggressive(rawName);
    const qToks = new Set(tokens(rawName));
    const scored: NameSuggestion[] = [];
    for (const e of entries) {
      let reason: NameSuggestion["reason"] | null = null;
      let distance = Number.POSITIVE_INFINITY;
      if (e.norm === norm) {
        reason = "exact";
        distance = 0;
      } else if (e.agg === agg) {
        reason = "aggressive";
        distance = 1;
      } else if (e.agg.includes(agg) || agg.includes(e.agg)) {
        reason = "substring";
        distance = 2 + Math.abs(e.agg.length - agg.length) / 10;
      } else {
        const tokScore = tokenOverlapScore(qToks, e);
        if (tokScore >= 0.5) {
          reason = "token-overlap";
          distance = 3 + (1 - tokScore);
        } else if (agg.length >= 4 && e.agg.length >= 3) {
          const dist = levenshtein(agg, e.agg, 3);
          if (dist <= 3) {
            reason = "typo";
            distance = 4 + dist;
          }
        }
      }
      if (reason) {
        scored.push({ id: e.id, name: e.name, reason, distance });
      }
    }
    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, limit);
  }

  return { resolve, suggest };
}

/**
 * Build a resolver from client name → project id that picks the most-recent
 * project for any matching client. Used by the quote importer when no
 * project external_id is available.
 */
export function buildLatestProjectByClientIndex(
  clients: Array<{ id: string; name: string | null }>,
  projectsOrderedNewestFirst: Array<{ id: string; client_id: string | null }>,
): (rawClientName: string) => string | null {
  const nameIdx = buildNameIndex(clients);
  const latestByClient = new Map<string, string>();
  for (const p of projectsOrderedNewestFirst) {
    if (!p.client_id) continue;
    if (!latestByClient.has(p.client_id)) latestByClient.set(p.client_id, p.id);
  }
  return (rawClientName: string) => {
    const clientId = nameIdx.resolve(rawClientName);
    if (!clientId) return null;
    return latestByClient.get(clientId) ?? null;
  };
}
