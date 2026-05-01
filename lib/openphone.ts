/**
 * OpenPhone adapter. Real implementation talks to OpenPhone's REST API
 * directly (the MCP server is great for chat-time tool use but a Vercel
 * cron can't open an MCP connection on each invocation — REST is the
 * right seam for scheduled work and outbound SMS). `getOpenPhoneAdapter()`
 * returns the real adapter when `OPENPHONE_API_KEY` is set, otherwise the
 * stub, so callers never branch on env state.
 *
 * The backfill cron (`app/api/cron/openphone-backfill`) uses
 * `listCallsSince()` / `listMessagesSince()` to poll every phone number
 * on the account. The stub returns [] for both so the cron is safe to
 * run before creds land.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export type OpenPhoneCall = {
  external_id: string;
  direction: "inbound" | "outbound";
  phone_number: string;
  started_at: string; // ISO
  duration_s: number | null;
  recording_url: string | null;
  transcript: string | null;
  was_missed: boolean;
};

export type OpenPhoneMessage = {
  external_id: string;
  direction: "inbound" | "outbound";
  phone_number: string;
  started_at: string;
  body: string;
  /** URLs of any media attached to the message (MMS, shared
   *  photos). Real adapter populates; stub leaves empty. The
   *  OpenPhone-attachment auto-attach cron uses these to save
   *  incoming photos to the matching client's file tray. */
  media_urls?: string[];
};

export type OpenPhoneSendResult =
  | { ok: true; external_id: string | null }
  | { ok: false; error: string; skip: boolean };

export type OpenPhoneAdapter = {
  listCallsForPhone(phone: string): Promise<OpenPhoneCall[]>;
  listMessagesForPhone(phone: string): Promise<OpenPhoneMessage[]>;
  listRecentInboundCalls(): Promise<OpenPhoneCall[]>;
  /**
   * Backfill helpers — pull everything (across every account phone number)
   * since the given ISO timestamp. The cron uses these; UI callers don't
   * need them. Default impls on the stub return [].
   */
  listCallsSince(sinceIso: string): Promise<OpenPhoneCall[]>;
  listMessagesSince(sinceIso: string): Promise<OpenPhoneMessage[]>;
  startCall(phone: string): Promise<{ ok: boolean; error?: string }>;
  /**
   * Free-form outbound SMS. Used by the on-my-way button and any other
   * one-off sends. `skip=true` on the error path means "adapter not wired"
   * — the caller should treat the send as a soft-skip, not a hard failure.
   */
  sendMessage(phone: string, body: string): Promise<OpenPhoneSendResult>;
};

export function createStubOpenPhone(): OpenPhoneAdapter {
  return {
    async listCallsForPhone() {
      return [];
    },
    async listMessagesForPhone() {
      return [];
    },
    async listRecentInboundCalls() {
      return [];
    },
    async listCallsSince() {
      return [];
    },
    async listMessagesSince() {
      return [];
    },
    async startCall() {
      return { ok: false, error: "OpenPhone MCP not wired yet." };
    },
    async sendMessage() {
      return {
        ok: false,
        error: "OpenPhone MCP not wired yet.",
        skip: true,
      };
    },
  };
}

// ----- real REST adapter -----

const OPENPHONE_BASE_URL = "https://api.openphone.com/v1";

// OpenPhone's GET /v1/phone-numbers payload returns the E.164 string under
// `number`, NOT `phoneNumber` (verified against the live API on 2026-04-18).
// The type alias was previously `phoneNumber` which silently resolved to
// undefined and broke outbound SMS — every send returned 400 with
// "/from: Expected required property". Fixed in tandem with the marketing
// site's auto-text rollout, which was the first code path exercising
// sendMessage in production.
type OpenPhoneNumber = { id: string; number: string };

export type OpenPhoneApiCall = {
  id: string;
  direction: "incoming" | "outgoing";
  from: string;
  to: string[] | string;
  phoneNumberId: string;
  createdAt: string;
  answeredAt?: string | null;
  completedAt?: string | null;
  duration?: number | null;
  media?: { url?: string; type?: string }[];
  recording?: { url?: string } | null;
  status?: string;
  voicemail?: unknown;
};

export type OpenPhoneApiMessage = {
  id: string;
  direction: "incoming" | "outgoing";
  from: string;
  to: string[] | string;
  phoneNumberId: string;
  createdAt: string;
  text?: string;
  body?: string;
  // MMS/media attached to the message. OpenPhone returns these either
  // under `media: [{ url, type }]` (new API shape) or `mediaUrls:
  // string[]` (legacy). We accept both so the adapter survives the
  // next API tweak.
  media?: Array<{ url?: string; type?: string }>;
  mediaUrls?: string[];
};

type OpenPhoneListResponse<T> = {
  data?: T[];
  results?: T[];
  nextPageToken?: string;
};

async function openPhoneFetch<T>(
  path: string,
  apiKey: string
): Promise<OpenPhoneListResponse<T>> {
  const res = await fetch(`${OPENPHONE_BASE_URL}${path}`, {
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    // OpenPhone rate-limits aggressively — don't let Next cache these.
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenPhone ${res.status} ${res.statusText} on ${path}: ${body.slice(0, 200)}`
    );
  }
  return (await res.json()) as OpenPhoneListResponse<T>;
}

function otherParty(
  direction: "incoming" | "outgoing",
  from: string,
  to: string[] | string
): string {
  const toFirst = Array.isArray(to) ? to[0] ?? "" : to;
  return direction === "incoming" ? from : toFirst;
}

function dirMap(d: "incoming" | "outgoing"): "inbound" | "outbound" {
  return d === "incoming" ? "inbound" : "outbound";
}

function callMissed(c: OpenPhoneApiCall): boolean {
  if (c.direction !== "incoming") return false;
  const d = c.duration ?? 0;
  const answered = c.answeredAt || (c.status && c.status === "completed" && d > 0);
  return !answered;
}

export function mapCall(c: OpenPhoneApiCall): OpenPhoneCall {
  return {
    external_id: c.id,
    direction: dirMap(c.direction),
    phone_number: otherParty(c.direction, c.from, c.to),
    started_at: c.createdAt,
    duration_s: typeof c.duration === "number" ? c.duration : null,
    recording_url: c.recording?.url ?? c.media?.find((m) => m.url)?.url ?? null,
    transcript: null, // transcript fetched separately when we wire the AI scrubber
    was_missed: callMissed(c),
  };
}

export function mapMessage(m: OpenPhoneApiMessage): OpenPhoneMessage {
  const mediaFromObjs = (m.media ?? [])
    .map((x) => x.url)
    .filter((u): u is string => Boolean(u));
  const media_urls = [
    ...(m.mediaUrls ?? []),
    ...mediaFromObjs,
  ];
  return {
    external_id: m.id,
    direction: dirMap(m.direction),
    phone_number: otherParty(m.direction, m.from, m.to),
    started_at: m.createdAt,
    body: m.text ?? m.body ?? "",
    media_urls: media_urls.length > 0 ? media_urls : undefined,
  };
}

export function createOpenPhoneRestAdapter(apiKey: string): OpenPhoneAdapter {
  let numberCache: OpenPhoneNumber[] | null = null;
  // When OPENPHONE_PHONE_NUMBER_ID is set, all sends + backfills are scoped
  // to that one phoneNumberId. Useful when the account has multiple numbers
  // (main line + voicemail-only) and we only want app traffic on one.
  const pinnedId = process.env.OPENPHONE_PHONE_NUMBER_ID ?? null;

  async function phoneNumbers(): Promise<OpenPhoneNumber[]> {
    if (numberCache) return numberCache;
    const res = await openPhoneFetch<OpenPhoneNumber>("/phone-numbers", apiKey);
    const all = res.data ?? res.results ?? [];
    numberCache = pinnedId ? all.filter((n) => n.id === pinnedId) : all;
    // If the pinned id didn't match anything the account has, fall back to
    // the full list so we don't silently stop sending — better to send from
    // the wrong number and log a warning than to go dark.
    if (pinnedId && numberCache.length === 0) {
      console.warn(
        `[openphone] OPENPHONE_PHONE_NUMBER_ID=${pinnedId} did not match any account number; falling back to all`,
      );
      numberCache = all;
    }
    return numberCache;
  }

  async function listCallsFor(
    phoneNumberId: string,
    sinceIso?: string,
    participants?: string
  ): Promise<OpenPhoneApiCall[]> {
    const params = new URLSearchParams();
    params.set("phoneNumberId", phoneNumberId);
    params.set("maxResults", "100");
    if (sinceIso) params.set("since", sinceIso);
    if (participants) params.set("participants", participants);
    const res = await openPhoneFetch<OpenPhoneApiCall>(
      `/calls?${params.toString()}`,
      apiKey
    );
    return res.data ?? res.results ?? [];
  }

  async function listMessagesFor(
    phoneNumberId: string,
    sinceIso?: string,
    participants?: string
  ): Promise<OpenPhoneApiMessage[]> {
    const params = new URLSearchParams();
    params.set("phoneNumberId", phoneNumberId);
    params.set("maxResults", "100");
    if (sinceIso) params.set("since", sinceIso);
    if (participants) params.set("participants", participants);
    const res = await openPhoneFetch<OpenPhoneApiMessage>(
      `/messages?${params.toString()}`,
      apiKey
    );
    return res.data ?? res.results ?? [];
  }

  return {
    async listCallsForPhone(phone) {
      const normalized = normalizePhone(phone);
      if (!normalized) return [];
      const numbers = await phoneNumbers();
      const all: OpenPhoneApiCall[] = [];
      for (const n of numbers) {
        const batch = await listCallsFor(n.id, undefined, normalized);
        all.push(...batch);
      }
      return all.map(mapCall);
    },
    async listMessagesForPhone(phone) {
      const normalized = normalizePhone(phone);
      if (!normalized) return [];
      const numbers = await phoneNumbers();
      const all: OpenPhoneApiMessage[] = [];
      for (const n of numbers) {
        const batch = await listMessagesFor(n.id, undefined, normalized);
        all.push(...batch);
      }
      return all.map(mapMessage);
    },
    async listRecentInboundCalls() {
      const numbers = await phoneNumbers();
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const all: OpenPhoneApiCall[] = [];
      for (const n of numbers) {
        const batch = await listCallsFor(n.id, since);
        all.push(...batch);
      }
      return all.filter((c) => c.direction === "incoming").map(mapCall);
    },
    async listCallsSince(sinceIso) {
      const numbers = await phoneNumbers();
      const all: OpenPhoneApiCall[] = [];
      for (const n of numbers) {
        const batch = await listCallsFor(n.id, sinceIso);
        all.push(...batch);
      }
      return all.map(mapCall);
    },
    async listMessagesSince(sinceIso) {
      const numbers = await phoneNumbers();
      const all: OpenPhoneApiMessage[] = [];
      for (const n of numbers) {
        const batch = await listMessagesFor(n.id, sinceIso);
        all.push(...batch);
      }
      return all.map(mapMessage);
    },
    async startCall() {
      // OpenPhone doesn't expose outbound dial over REST; the call is
      // placed from the OpenPhone app. We deliberately surface that as a
      // non-error so the UI keeps working.
      return {
        ok: false,
        error: "Outbound dial is not available over REST — place from OpenPhone.",
      };
    },
    async sendMessage(phone, body) {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        return { ok: false, error: "Invalid phone number.", skip: false };
      }
      const numbers = await phoneNumbers();
      if (numbers.length === 0) {
        return {
          ok: false,
          error: "No OpenPhone numbers on this account.",
          skip: true,
        };
      }
      // Pin to OPENPHONE_PHONE_NUMBER_ID when set so the marketing auto-SMS
      // always comes from Ronnie's published business line, not whatever
      // number the API happens to list first. Falls back to the first
      // number for back-compat with the reminder cron.
      const pinnedId = process.env.OPENPHONE_PHONE_NUMBER_ID;
      const from =
        (pinnedId && numbers.find((n) => n.id === pinnedId)) || numbers[0];
      const res = await fetch(`${OPENPHONE_BASE_URL}/messages`, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: from.number,
          to: [normalized],
          content: body,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return {
          ok: false,
          error: `OpenPhone ${res.status}: ${errBody.slice(0, 200)}`,
          skip: false,
        };
      }
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        data?: { id?: string };
      };
      return { ok: true, external_id: json.id ?? json.data?.id ?? null };
    },
  };
}

/**
 * Single entry point for the rest of the app. Returns the real REST adapter
 * when `OPENPHONE_API_KEY` is set, otherwise the stub — so callers never
 * branch on env state.
 */
export function getOpenPhoneAdapter(): OpenPhoneAdapter {
  const apiKey = process.env.OPENPHONE_API_KEY;
  if (!apiKey) return createStubOpenPhone();
  return createOpenPhoneRestAdapter(apiKey);
}

/** E164-ish normalize: strip non-digits, prepend +1 if 10 digits. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/[^0-9]/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 11) return `+${d}`;
  return null;
}

/**
 * Produce the set of lookup variants for a phone number so DB matching
 * survives formatting drift between what Jobber dumped into `clients.phone`
 * and what OpenPhone reports in its API payloads.
 *
 * Returns up to 3 variants:
 *   - full E.164 (`+16195551234`)
 *   - national 10-digit (`6195551234`)
 *   - last 10 of whatever was passed in (catches odd formats like +44…)
 */
export function phoneMatchVariants(
  raw: string | null | undefined
): string[] {
  if (!raw) return [];
  const digits = raw.replace(/[^0-9]/g, "");
  const normalized = normalizePhone(raw);
  const last10 = digits.length >= 10 ? digits.slice(-10) : null;
  const variants = new Set<string>();
  if (normalized) variants.add(normalized);
  if (last10) variants.add(last10);
  if (digits.length > 0) variants.add(digits);
  return Array.from(variants);
}

/**
 * Sync result returned by `syncOpenPhoneCalls` / `syncOpenPhoneMessages`.
 * The cron and the webhook both surface these counts in their response
 * for observability.
 */
export type OpenPhoneSyncResult = {
  inserted: number;
  leadsCreated: number;
  missedCallTasks: number;
  errors: string[];
};

/**
 * Insert a batch of OpenPhone calls into `communications`, attaching to
 * existing clients by phone match and routing unknown numbers through
 * `createLead()` (same pipeline as the Poptin webhook + /book form).
 *
 * Idempotent on `communications.external_id` — the unique index makes
 * webhook + cron double-delivery safe (one wins, the other gets a
 * "duplicate key" error which we silently ignore).
 *
 * Missed inbound calls auto-seed a row in `tasks` so Ronnie sees them on
 * the dashboard. Matches the behaviour the cron has had since shipping.
 */
export async function syncOpenPhoneCalls(
  supabase: SupabaseClient,
  calls: OpenPhoneCall[],
): Promise<OpenPhoneSyncResult> {
  const result: OpenPhoneSyncResult = {
    inserted: 0,
    leadsCreated: 0,
    missedCallTasks: 0,
    errors: [],
  };
  if (!calls || calls.length === 0) return result;

  const { phoneToClientId, lookupClientId, ensureClientForUnknown } =
    await buildClientLookup(supabase);

  // Pre-load existing external_ids in one round trip so we don't insert
  // a row only for the unique-index to bounce it. (The catch path below
  // still handles concurrent-write races.)
  const externalIds = calls.map((c) => c.external_id).filter(Boolean);
  const seen = await loadSeenExternalIds(supabase, externalIds);

  for (const call of calls) {
    if (call.external_id && seen.has(call.external_id)) continue;
    let clientId = lookupClientId(call.phone_number);
    if (!clientId) {
      const { clientId: newId, leadCreated } = await ensureClientForUnknown(
        call.phone_number,
      );
      clientId = newId;
      if (leadCreated) result.leadsCreated++;
    }
    const { error } = await supabase.from("communications").insert({
      client_id: clientId,
      external_id: call.external_id,
      direction: call.direction,
      channel: "call",
      phone_number: normalizePhone(call.phone_number) ?? call.phone_number,
      started_at: call.started_at,
      duration_s: call.duration_s,
      recording_url: call.recording_url,
      transcript: call.transcript,
      was_missed: call.was_missed,
    });
    if (error) {
      // duplicate-key races are expected (cron + webhook both ingesting).
      if (!/duplicate key/i.test(error.message)) {
        console.error("[openphone-sync] call insert failed", error);
        result.errors.push(`call ${call.external_id}: ${error.message}`);
      }
      continue;
    }
    seen.add(call.external_id);
    result.inserted++;

    if (call.was_missed && clientId) {
      const taskOk = await seedMissedCallTask(supabase, clientId, call);
      if (taskOk) result.missedCallTasks++;
    }

    // Attach the phone to the lookup map so a follow-up SMS in the same
    // batch (e.g. webhook batch) routes to the just-created client.
    if (clientId) {
      for (const v of phoneMatchVariants(call.phone_number)) {
        phoneToClientId.set(v, clientId);
      }
    }
  }
  return result;
}

/** Same as syncOpenPhoneCalls but for SMS. */
export async function syncOpenPhoneMessages(
  supabase: SupabaseClient,
  messages: OpenPhoneMessage[],
): Promise<OpenPhoneSyncResult> {
  const result: OpenPhoneSyncResult = {
    inserted: 0,
    leadsCreated: 0,
    missedCallTasks: 0,
    errors: [],
  };
  if (!messages || messages.length === 0) return result;

  const { phoneToClientId, lookupClientId, ensureClientForUnknown } =
    await buildClientLookup(supabase);

  const externalIds = messages.map((m) => m.external_id).filter(Boolean);
  const seen = await loadSeenExternalIds(supabase, externalIds);

  for (const msg of messages) {
    if (msg.external_id && seen.has(msg.external_id)) continue;
    let clientId = lookupClientId(msg.phone_number);
    if (!clientId) {
      const { clientId: newId, leadCreated } = await ensureClientForUnknown(
        msg.phone_number,
      );
      clientId = newId;
      if (leadCreated) result.leadsCreated++;
    }
    const { error } = await supabase.from("communications").insert({
      client_id: clientId,
      external_id: msg.external_id,
      direction: msg.direction,
      channel: "sms",
      phone_number: normalizePhone(msg.phone_number) ?? msg.phone_number,
      started_at: msg.started_at,
      body: msg.body,
    });
    if (error) {
      if (!/duplicate key/i.test(error.message)) {
        console.error("[openphone-sync] sms insert failed", error);
        result.errors.push(`sms ${msg.external_id}: ${error.message}`);
      }
      continue;
    }
    seen.add(msg.external_id);
    result.inserted++;

    if (clientId) {
      for (const v of phoneMatchVariants(msg.phone_number)) {
        phoneToClientId.set(v, clientId);
      }
    }
  }
  return result;
}

/**
 * Update the transcript on an existing `communications` row by external_id.
 * Used by the `call.transcript.completed` webhook event — by the time the
 * transcript is ready, the row was already inserted by `call.completed`.
 *
 * Returns true if a row was updated, false if no row matched. Silent no-op
 * on a transcript-only webhook for a call we never received via
 * `call.completed` (could happen if the webhook misses an event).
 */
export async function updateCallTranscript(
  supabase: SupabaseClient,
  externalId: string,
  transcript: string | null,
): Promise<boolean> {
  if (!externalId || !transcript) return false;
  const { data, error } = await supabase
    .from("communications")
    .update({ transcript })
    .eq("external_id", externalId)
    .select("id");
  if (error) {
    console.error("[openphone-sync] transcript update failed", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Pull a transcript from OpenPhone's REST API for a specific call.
 * Used as a fallback when the `call.transcript.completed` webhook
 * payload doesn't include transcript text inline (paranoid path —
 * the docs are ambiguous and we don't want to silently miss it).
 */
export async function getCallTranscript(
  callId: string,
  apiKey: string = process.env.OPENPHONE_API_KEY ?? "",
): Promise<string | null> {
  if (!apiKey || !callId) return null;
  const res = await fetch(
    `${OPENPHONE_BASE_URL}/call-transcripts/${encodeURIComponent(callId)}`,
    {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    if (res.status !== 404) {
      console.warn(
        `[openphone] transcript fetch ${res.status} for call ${callId}`,
      );
    }
    return null;
  }
  type TranscriptResp = {
    data?: {
      transcript?: string;
      dialogue?: Array<{ content?: string; speaker?: string }>;
    };
  };
  const json = (await res.json().catch(() => ({}))) as TranscriptResp;
  if (json.data?.transcript) return json.data.transcript;
  if (json.data?.dialogue?.length) {
    return json.data.dialogue
      .map((d) => `${d.speaker ?? "?"}: ${d.content ?? ""}`)
      .join("\n");
  }
  return null;
}

/**
 * Verify an OpenPhone webhook signature.
 *
 * Header format: `hmac;<version>;<timestamp_ms>;<base64_signature>`
 * Signed payload: `<timestamp> + "." + <raw_body>`
 * Algorithm: HMAC-SHA256 with a base64-decoded signing key (the key
 * Quo gives you in the dashboard when you create the webhook).
 *
 * Returns false on any malformed input — never throws, so the caller
 * can treat the boolean as the entire auth decision.
 *
 * MAX_SKEW_MS is 5 minutes — replay-protection. OpenPhone's docs are
 * silent on the right window but 5 min is the Stripe convention.
 */
const MAX_SIGNATURE_SKEW_MS = 5 * 60 * 1000;

export function verifyOpenPhoneSignature(opts: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  signingKey: string;
  /** Override "now" for tests. */
  nowMs?: number;
}): { ok: boolean; reason?: string } {
  const { rawBody, signatureHeader, signingKey } = opts;
  const nowMs = opts.nowMs ?? Date.now();
  if (!signatureHeader) return { ok: false, reason: "missing-header" };
  if (!signingKey) return { ok: false, reason: "missing-signing-key" };

  const parts = signatureHeader.split(";");
  if (parts.length !== 4) return { ok: false, reason: "bad-format" };
  const [scheme, version, timestampStr, signatureB64] = parts;
  if (scheme !== "hmac") return { ok: false, reason: "bad-scheme" };
  if (version !== "1") return { ok: false, reason: "bad-version" };
  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "bad-timestamp" };
  }
  if (Math.abs(nowMs - timestamp) > MAX_SIGNATURE_SKEW_MS) {
    return { ok: false, reason: "stale-timestamp" };
  }

  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(signingKey, "base64");
  } catch {
    return { ok: false, reason: "bad-key" };
  }

  // Strip whitespace/newlines from JSON body before signing — per
  // OpenPhone's verification spec.
  const stripped = rawBody.replace(/\s/g, "");
  const signed = `${timestampStr}.${stripped}`;
  const expected = createHmac("sha256", keyBytes).update(signed).digest("base64");

  let actualBuf: Buffer;
  try {
    actualBuf = Buffer.from(signatureB64, "base64");
  } catch {
    return { ok: false, reason: "bad-signature" };
  }
  const expectedBuf = Buffer.from(expected, "base64");
  if (actualBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "length-mismatch" };
  }
  if (!timingSafeEqual(actualBuf, expectedBuf)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}

// ----- internals shared by the syncers -----

type ClientRow = { id: string; phone: string | null };

async function buildClientLookup(supabase: SupabaseClient): Promise<{
  phoneToClientId: Map<string, string>;
  lookupClientId: (phone: string) => string | null;
  ensureClientForUnknown: (
    phone: string,
  ) => Promise<{ clientId: string | null; leadCreated: boolean }>;
}> {
  const { data: clients } = await supabase
    .from("clients")
    .select("id, phone");
  const phoneToClientId = new Map<string, string>();
  for (const c of (clients ?? []) as ClientRow[]) {
    for (const v of phoneMatchVariants(c.phone)) {
      if (!phoneToClientId.has(v)) phoneToClientId.set(v, c.id);
    }
  }

  function lookupClientId(phone: string): string | null {
    for (const v of phoneMatchVariants(phone)) {
      const id = phoneToClientId.get(v);
      if (id) return id;
    }
    return null;
  }

  async function ensureClientForUnknown(
    phone: string,
  ): Promise<{ clientId: string | null; leadCreated: boolean }> {
    const normalized = normalizePhone(phone) ?? phone;
    // Lazy import — `lib/leads.ts` imports `lib/openphone.ts`, so a
    // top-level import would create a cycle.
    const { createLead } = await import("@/lib/leads");
    const result = await createLead(
      {
        source: "openphone_inbound",
        phone: normalized,
        name: null,
        email: null,
        raw_payload: { phone: normalized, intake: "openphone_sync" },
      },
      supabase,
    );
    if (!result.ok) {
      console.error("[openphone-sync] createLead failed", result.error);
      return { clientId: null, leadCreated: false };
    }
    if (result.duplicate) {
      const { data } = await supabase
        .from("leads")
        .select("client_id")
        .eq("id", result.lead_id)
        .maybeSingle();
      return { clientId: data?.client_id ?? null, leadCreated: false };
    }
    return { clientId: result.client_id, leadCreated: true };
  }

  return { phoneToClientId, lookupClientId, ensureClientForUnknown };
}

async function loadSeenExternalIds(
  supabase: SupabaseClient,
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const { data } = await supabase
    .from("communications")
    .select("external_id")
    .in("external_id", externalIds);
  return new Set(
    ((data ?? []) as Array<{ external_id: string | null }>)
      .map((r) => r.external_id)
      .filter(Boolean) as string[],
  );
}

async function seedMissedCallTask(
  supabase: SupabaseClient,
  clientId: string,
  call: OpenPhoneCall,
): Promise<boolean> {
  const phone = normalizePhone(call.phone_number) ?? call.phone_number;
  const { error } = await supabase.from("tasks").insert({
    title: `Missed call from ${phone}`,
    body: call.recording_url
      ? `Voicemail: ${call.recording_url}`
      : "No voicemail.",
    client_id: clientId,
    source: "missed_call",
    source_id: call.external_id,
    status: "open",
  });
  if (error) {
    console.error("[openphone-sync] task insert failed", error);
    return false;
  }
  return true;
}
