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

type OpenPhoneApiCall = {
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

type OpenPhoneApiMessage = {
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

function mapCall(c: OpenPhoneApiCall): OpenPhoneCall {
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

function mapMessage(m: OpenPhoneApiMessage): OpenPhoneMessage {
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
