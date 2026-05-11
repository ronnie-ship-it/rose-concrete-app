/**
 * Known-caller suppression gate for the OpenPhone inbound-call path.
 *
 * Background: every inbound OpenPhone call routes through
 * `ensureClientForUnknown()` in `lib/openphone.ts`, which calls
 * `createLead({ source: "openphone_inbound" })` for any number not already
 * in Supabase `clients`. That sends a "New lead" Resend email — which is
 * noisy when the caller is actually a repeat customer who happens to live
 * in Jobber, OpenPhone contacts, or earlier `communications` history but
 * not yet in `clients`.
 *
 * `isKnownInboundCaller()` is the gate. It runs four lookups in parallel
 * via `Promise.allSettled` and reports back whether ANY of them recognise
 * the number. Fail-open: a thrown lookup is logged to `errors` and does
 * not count as a miss — we'd rather email Ronnie once than silently drop
 * a real lead because Jobber was 500-ing.
 *
 * Sources:
 *   1. Supabase `communications` — prior call/SMS history (any direction)
 *   2. Supabase `clients` — direct phone match (defensive; the call-site's
 *      in-memory map should already catch this, but races between map
 *      build and processing can miss within a single sync batch)
 *   3. Jobber — phone search via GraphQL, verified against the returned
 *      `phoneNumbers[].number` because Jobber's `searchTerm` is fuzzy
 *   4. OpenPhone — REST `GET /v1/contacts` by phone
 *
 * Phone is normalised once to E.164 (`+1XXXXXXXXXX`) and queried using
 * the full variant set from `phoneMatchVariants()` so format drift
 * between systems (`+16195379408` vs `(619) 537-9408` vs `6195379408`)
 * doesn't cause false negatives.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePhone,
  phoneMatchVariants,
  type OpenPhoneAdapter,
} from "@/lib/openphone";
import { findJobberClientByPhone } from "@/lib/jobber-api";

export type KnownCallerSource =
  | "communications"
  | "clients"
  | "jobber"
  | "openphone";

export type KnownCallerResult = {
  known: boolean;
  /** Every source that returned a positive hit. */
  sources: KnownCallerSource[];
  /**
   * Supabase `clients.id` when the clients or communications lookup
   * returned one. Lets the OpenPhone webhook attach the new
   * `communications` row to an existing client rather than orphaning it.
   */
  clientId: string | null;
  /** Sources whose lookup threw — informational, never blocks. */
  errors: { source: KnownCallerSource; error: string }[];
};

export type KnownCallerDeps = {
  supabase: SupabaseClient;
  openphone: OpenPhoneAdapter;
  /** Result of `getValidJobberAccessToken(supabase)`. `null` ⇒ skip Jobber. */
  jobberToken: string | null;
  /**
   * Injectable Jobber lookup. Defaults to `findJobberClientByPhone()`
   * from `lib/jobber-api.ts`. Tests pass a stub to avoid network.
   */
  jobberLookup?: (token: string, phone: string) => Promise<boolean>;
};

type LookupOutcome = {
  source: KnownCallerSource;
  hit: boolean;
  clientId: string | null;
  error: string | null;
};

async function checkCommunications(
  supabase: SupabaseClient,
  variants: string[],
): Promise<LookupOutcome> {
  try {
    const { data, error } = await supabase
      .from("communications")
      .select("id, client_id")
      .in("phone_number", variants)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { source: "communications", hit: false, clientId: null, error: null };
    }
    return {
      source: "communications",
      hit: true,
      clientId: (data as { client_id: string | null }).client_id ?? null,
      error: null,
    };
  } catch (err) {
    return {
      source: "communications",
      hit: false,
      clientId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkClients(
  supabase: SupabaseClient,
  variants: string[],
): Promise<LookupOutcome> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .in("phone", variants)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { source: "clients", hit: false, clientId: null, error: null };
    }
    return {
      source: "clients",
      hit: true,
      clientId: (data as { id: string }).id,
      error: null,
    };
  } catch (err) {
    return {
      source: "clients",
      hit: false,
      clientId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkJobber(
  token: string | null,
  phone: string,
  lookup: (token: string, phone: string) => Promise<boolean>,
): Promise<LookupOutcome> {
  if (!token) {
    // Not configured — treat as a skip, not an error. Fail-open by design.
    return { source: "jobber", hit: false, clientId: null, error: null };
  }
  try {
    const hit = await lookup(token, phone);
    return { source: "jobber", hit, clientId: null, error: null };
  } catch (err) {
    return {
      source: "jobber",
      hit: false,
      clientId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkOpenPhone(
  openphone: OpenPhoneAdapter,
  phone: string,
): Promise<LookupOutcome> {
  if (!openphone.isConfigured()) {
    // Stub adapter — nothing to ask.
    return { source: "openphone", hit: false, clientId: null, error: null };
  }
  try {
    const contact = await openphone.findContactByPhone(phone);
    return {
      source: "openphone",
      hit: contact !== null,
      clientId: null,
      error: null,
    };
  } catch (err) {
    return {
      source: "openphone",
      hit: false,
      clientId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function isKnownInboundCaller(
  rawPhone: string,
  deps: KnownCallerDeps,
): Promise<KnownCallerResult> {
  const normalized = normalizePhone(rawPhone) ?? rawPhone;
  const variants = phoneMatchVariants(normalized);

  // No usable phone — nothing to look up. Treat as unknown so the
  // existing createLead path can still flag the record for triage.
  if (variants.length === 0) {
    return { known: false, sources: [], clientId: null, errors: [] };
  }

  // allSettled belt + try/catch braces. Inside each `check*` we already
  // swallow throws; allSettled is the second line of defence so a logic
  // bug (e.g. a sync throw outside the try) can never crash the gate.
  const jobberLookup = deps.jobberLookup ?? findJobberClientByPhone;
  const results = await Promise.allSettled([
    checkCommunications(deps.supabase, variants),
    checkClients(deps.supabase, variants),
    checkJobber(deps.jobberToken, normalized, jobberLookup),
    checkOpenPhone(deps.openphone, normalized),
  ]);

  const sources: KnownCallerSource[] = [];
  const errors: KnownCallerResult["errors"] = [];
  // Prefer the clients-table clientId because that's the canonical
  // Supabase row to attach communications to. Fall back to whatever
  // `communications` reported.
  let clientIdFromClients: string | null = null;
  let clientIdFromComms: string | null = null;

  for (const r of results) {
    if (r.status !== "fulfilled") {
      // The check functions themselves never reject — but if one did,
      // we still want to record it. The source tag is best-effort.
      errors.push({
        source: "communications",
        error:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
      continue;
    }
    const outcome = r.value;
    if (outcome.error) {
      errors.push({ source: outcome.source, error: outcome.error });
    }
    if (outcome.hit) {
      sources.push(outcome.source);
      if (outcome.source === "clients" && outcome.clientId) {
        clientIdFromClients = outcome.clientId;
      } else if (outcome.source === "communications" && outcome.clientId) {
        clientIdFromComms = outcome.clientId;
      }
    }
  }

  return {
    known: sources.length > 0,
    sources,
    clientId: clientIdFromClients ?? clientIdFromComms,
    errors,
  };
}
