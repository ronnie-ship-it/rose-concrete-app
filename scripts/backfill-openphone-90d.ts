/**
 * One-shot 90-day OpenPhone backfill.
 *
 * Reuses the same row-mapping + dedup + lead-creation helpers as the
 * `openphone-backfill` cron, just with a 90-day lookback window and
 * proper pagination via `nextPageToken`. Idempotent on
 * `communications.external_id` — safe to re-run.
 *
 * Usage:
 *   OPENPHONE_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-openphone-90d.ts
 *
 * Env required:
 *   OPENPHONE_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   OPENPHONE_PHONE_NUMBER_ID — pin to one number (otherwise iterates
 *     over every phone number on the account)
 *   BACKFILL_DAYS — override 90 (default) for a shorter test run
 */

// Env vars expected via shell — match existing scripts/import-jobber.ts pattern.
import { createClient } from "@supabase/supabase-js";
import {
  mapCall,
  mapMessage,
  syncOpenPhoneCalls,
  syncOpenPhoneMessages,
  type OpenPhoneApiCall,
  type OpenPhoneApiMessage,
} from "../lib/openphone";

const OPENPHONE_BASE_URL = "https://api.openphone.com/v1";
const PAGE_SIZE = 100;

type ListResp<T> = {
  data?: T[];
  results?: T[];
  nextPageToken?: string | null;
};

type OpenPhoneNumber = { id: string; number: string };

async function fetchJson<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${OPENPHONE_BASE_URL}${path}`, {
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenPhone ${res.status} ${res.statusText} on ${path}: ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

async function* paginate<T>(
  basePath: string,
  apiKey: string,
): AsyncGenerator<T, void, void> {
  let pageToken: string | null = null;
  do {
    const sep: string = basePath.includes("?") ? "&" : "?";
    const reqPath: string = pageToken
      ? `${basePath}${sep}pageToken=${encodeURIComponent(pageToken)}`
      : basePath;
    const res: ListResp<T> = await fetchJson<ListResp<T>>(reqPath, apiKey);
    const items = res.data ?? res.results ?? [];
    for (const item of items) yield item;
    pageToken = res.nextPageToken ?? null;
    // Light pacing to stay friendly to Quo's rate limits. Adjust if
    // we hit 429s in practice.
    if (pageToken) await new Promise((r) => setTimeout(r, 250));
  } while (pageToken);
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENPHONE_API_KEY;
  if (!apiKey) {
    console.error("OPENPHONE_API_KEY not set — aborting.");
    process.exit(1);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set — aborting.",
    );
    process.exit(1);
  }

  const days = Number(process.env.BACKFILL_DAYS ?? 90);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  console.log(`[backfill] days=${days} since=${sinceIso}`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // List phone numbers — pin to OPENPHONE_PHONE_NUMBER_ID if set.
  const numbersResp = await fetchJson<ListResp<OpenPhoneNumber>>(
    "/phone-numbers",
    apiKey,
  );
  const allNumbers = numbersResp.data ?? numbersResp.results ?? [];
  const pinnedId = process.env.OPENPHONE_PHONE_NUMBER_ID;
  const numbers = pinnedId
    ? allNumbers.filter((n) => n.id === pinnedId)
    : allNumbers;
  if (numbers.length === 0) {
    console.error("No phone numbers found on this account.");
    process.exit(1);
  }
  console.log(`[backfill] phone_numbers=${numbers.length}`);

  let totalCalls = 0;
  let totalMessages = 0;
  const sumCalls = { inserted: 0, leadsCreated: 0, missedCallTasks: 0 };
  const sumMsgs = { inserted: 0, leadsCreated: 0 };
  const errors: string[] = [];

  for (const num of numbers) {
    console.log(`[backfill] ${num.number} (${num.id}) — calls...`);
    // Pull in batches of 200 then flush so memory stays bounded on
    // a chatty 90-day window. Same approach for SMS below.
    let batch: OpenPhoneApiCall[] = [];
    for await (const call of paginate<OpenPhoneApiCall>(
      `/calls?phoneNumberId=${num.id}&maxResults=${PAGE_SIZE}&since=${encodeURIComponent(sinceIso)}`,
      apiKey,
    )) {
      batch.push(call);
      totalCalls++;
      if (batch.length >= 200) {
        const res = await syncOpenPhoneCalls(supabase, batch.map(mapCall));
        sumCalls.inserted += res.inserted;
        sumCalls.leadsCreated += res.leadsCreated;
        sumCalls.missedCallTasks += res.missedCallTasks;
        errors.push(...res.errors);
        batch = [];
      }
    }
    if (batch.length > 0) {
      const res = await syncOpenPhoneCalls(supabase, batch.map(mapCall));
      sumCalls.inserted += res.inserted;
      sumCalls.leadsCreated += res.leadsCreated;
      sumCalls.missedCallTasks += res.missedCallTasks;
      errors.push(...res.errors);
    }

    console.log(`[backfill] ${num.number} (${num.id}) — messages...`);
    let mbatch: OpenPhoneApiMessage[] = [];
    for await (const msg of paginate<OpenPhoneApiMessage>(
      `/messages?phoneNumberId=${num.id}&maxResults=${PAGE_SIZE}&since=${encodeURIComponent(sinceIso)}`,
      apiKey,
    )) {
      mbatch.push(msg);
      totalMessages++;
      if (mbatch.length >= 200) {
        const res = await syncOpenPhoneMessages(
          supabase,
          mbatch.map(mapMessage),
        );
        sumMsgs.inserted += res.inserted;
        sumMsgs.leadsCreated += res.leadsCreated;
        errors.push(...res.errors);
        mbatch = [];
      }
    }
    if (mbatch.length > 0) {
      const res = await syncOpenPhoneMessages(supabase, mbatch.map(mapMessage));
      sumMsgs.inserted += res.inserted;
      sumMsgs.leadsCreated += res.leadsCreated;
      errors.push(...res.errors);
    }
  }

  console.log("---");
  console.log(`[backfill] fetched calls=${totalCalls} messages=${totalMessages}`);
  console.log(
    `[backfill] inserted calls=${sumCalls.inserted} ` +
      `messages=${sumMsgs.inserted} ` +
      `(skipped ${totalCalls - sumCalls.inserted + (totalMessages - sumMsgs.inserted)} as dupes/no-ops)`,
  );
  console.log(
    `[backfill] leads_created=${sumCalls.leadsCreated + sumMsgs.leadsCreated} ` +
      `missed_call_tasks=${sumCalls.missedCallTasks}`,
  );
  if (errors.length > 0) {
    console.warn(`[backfill] errors=${errors.length}`);
    for (const e of errors.slice(0, 20)) console.warn("  -", e);
  }
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
