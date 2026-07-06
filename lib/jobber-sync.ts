/**
 * Jobber → app schedule sync (crew-rebuild phase 1).
 *
 * One-way: Jobber wins on schedule fields (when, what job, which client);
 * the app owns field data (photos, crew notes, status updates). Ronnie keeps
 * scheduling inside Jobber; the crew app reads its schedule from here.
 *
 * Window: visits from 14 days back to 14 days ahead. Wide enough that the
 * crew Home/Schedule views never miss a visit, small enough to stay far
 * under Jobber's rate limits at a 15-minute cron cadence.
 *
 * Dedupe: everything is keyed on Jobber node ids (`jobber_id` columns added
 * in migration 042). Upserts are idempotent; re-running is always safe.
 *
 * Removal: a visit we previously synced that no longer comes back inside
 * the window (and isn't completed in our DB) gets `deleted_at` set — soft
 * delete only, per repo hard rules.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getValidJobberAccessToken,
  jobberGraphQL,
  type JobberFetchError,
} from "@/lib/jobber-api";

const WINDOW_BACK_DAYS = 14;
const WINDOW_AHEAD_DAYS = 14;
const PAGE_SIZE = 50;
const MAX_PAGES = 20; // hard stop — 1000 visits in a 4-week window means something is wrong

export type JobberSyncSummary = {
  ok: boolean;
  error?: string;
  clientsUpserted: number;
  projectsUpserted: number;
  visitsUpserted: number;
  visitsRemoved: number;
};

// ---------- GraphQL shapes (nullable-defensive; Jobber schema drifts) ----------

type RawVisit = {
  id: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  isComplete: boolean | null;
  instructions: string | null;
  job: {
    id: string;
    title: string | null;
    jobNumber: number | null;
  } | null;
  client: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    emails: Array<{ address: string }> | null;
    phoneNumbers: Array<{ number: string }> | null;
  } | null;
  property: {
    address: {
      street: string | null;
      city: string | null;
      province: string | null;
      postalCode: string | null;
    } | null;
  } | null;
};

type RawVisitsPage = {
  visits: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: RawVisit }>;
  };
};

const VISITS_QUERY = `
  query CrewScheduleVisits($first: Int!, $after: String, $start: ISO8601DateTime!, $end: ISO8601DateTime!) {
    visits(
      first: $first
      after: $after
      filter: { startAt: { after: $start, before: $end } }
    ) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          startAt
          endAt
          isComplete
          instructions
          job { id title jobNumber }
          client {
            id
            name
            firstName
            lastName
            emails { address }
            phoneNumbers { number }
          }
          property {
            address { street city province postalCode }
          }
        }
      }
    }
  }
`;

// ---------- helpers ----------

function minutesBetween(startISO: string, endISO: string | null): number {
  if (!endISO) return 60;
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 60;
  return Math.max(15, Math.round(ms / 60_000));
}

function addressLine(v: RawVisit): string | null {
  const a = v.property?.address;
  if (!a) return null;
  const line = [a.street, a.city, a.province, a.postalCode]
    .filter(Boolean)
    .join(", ");
  return line || null;
}

// ---------- upsert steps ----------

async function upsertClient(
  supabase: SupabaseClient,
  v: RawVisit,
): Promise<{ id: string | null; created: boolean }> {
  const c = v.client;
  if (!c) return { id: null, created: false };

  // 1. Already mirrored?
  const { data: byJobberId } = await supabase
    .from("clients")
    .select("id")
    .eq("jobber_id", c.id)
    .maybeSingle();
  if (byJobberId) return { id: byJobberId.id as string, created: false };

  // 2. Match an existing app client by phone, then email — then tag it
  //    with the jobber_id so next run takes the fast path.
  const phone = (c.phoneNumbers ?? [])[0]?.number ?? null;
  const email = (c.emails ?? [])[0]?.address?.toLowerCase() ?? null;
  if (phone) {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      const { data } = await supabase
        .from("clients")
        .select("id, phone")
        .not("phone", "is", null)
        .like("phone", `%${digits.slice(0, 3)}%`)
        .limit(50);
      const hit = (data ?? []).find(
        (row) => (row.phone as string).replace(/\D/g, "").slice(-10) === digits,
      );
      if (hit) {
        await supabase.from("clients").update({ jobber_id: c.id }).eq("id", hit.id);
        return { id: hit.id as string, created: false };
      }
    }
  }
  if (email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data) {
      await supabase.from("clients").update({ jobber_id: c.id }).eq("id", data.id);
      return { id: data.id as string, created: false };
    }
  }

  // 3. Create a mirror row.
  const name =
    c.name ??
    [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ??
    "Jobber client";
  const { data: inserted, error } = await supabase
    .from("clients")
    .insert({
      name: name || "Jobber client",
      phone,
      email,
      source: "jobber_sync",
      jobber_id: c.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { id: null, created: false };
  return { id: inserted.id as string, created: true };
}

async function upsertProject(
  supabase: SupabaseClient,
  v: RawVisit,
  clientId: string,
): Promise<{ id: string | null; created: boolean }> {
  const job = v.job;
  if (!job) return { id: null, created: false };

  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("jobber_id", job.id)
    .maybeSingle();
  if (existing) return { id: existing.id as string, created: false };

  const name =
    job.title ??
    v.title ??
    (job.jobNumber ? `Jobber job #${job.jobNumber}` : "Jobber job");
  const { data: inserted, error } = await supabase
    .from("projects")
    .insert({
      client_id: clientId,
      name,
      location: addressLine(v),
      status: "scheduled",
      jobber_id: job.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { id: null, created: false };
  return { id: inserted.id as string, created: true };
}

async function upsertVisit(
  supabase: SupabaseClient,
  v: RawVisit,
  projectId: string,
): Promise<boolean> {
  if (!v.startAt) return false;
  const jobberFields = {
    project_id: projectId,
    scheduled_for: v.startAt,
    duration_min: minutesBetween(v.startAt, v.endAt),
    jobber_title: v.title ?? v.job?.title ?? null,
    jobber_instructions: v.instructions ?? null,
    jobber_synced_at: new Date().toISOString(),
    deleted_at: null, // came back from Jobber → it exists again
  };

  const { data: existing } = await supabase
    .from("visits")
    .select("id, status")
    .eq("jobber_id", v.id)
    .maybeSingle();

  if (existing) {
    // Jobber wins on schedule fields. Status: only let Jobber move a visit
    // to completed; never un-complete or overwrite crew-set in_progress.
    const patch: Record<string, unknown> = { ...jobberFields };
    if (v.isComplete && existing.status !== "completed") {
      patch.status = "completed";
      patch.completed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("visits")
      .update(patch)
      .eq("id", existing.id);
    return !error;
  }

  const { error } = await supabase.from("visits").insert({
    ...jobberFields,
    jobber_id: v.id,
    status: v.isComplete ? "completed" : "scheduled",
    completed_at: v.isComplete ? new Date().toISOString() : null,
  });
  return !error;
}

// ---------- main entry ----------

export async function syncJobberSchedule(
  supabase: SupabaseClient,
): Promise<JobberSyncSummary> {
  const summary: JobberSyncSummary = {
    ok: false,
    clientsUpserted: 0,
    projectsUpserted: 0,
    visitsUpserted: 0,
    visitsRemoved: 0,
  };

  const { data: run } = await supabase
    .from("jobber_sync_runs")
    .insert({})
    .select("id")
    .single();
  const runId = run?.id as string | undefined;

  const finish = async (error?: string) => {
    summary.ok = !error;
    if (error) summary.error = error;
    if (runId) {
      await supabase
        .from("jobber_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          ok: !error,
          error: error ?? null,
          visits_upserted: summary.visitsUpserted,
          visits_removed: summary.visitsRemoved,
          projects_upserted: summary.projectsUpserted,
          clients_upserted: summary.clientsUpserted,
        })
        .eq("id", runId);
    }
    return summary;
  };

  const token = await getValidJobberAccessToken(supabase);
  if (!token) {
    return finish(
      "Jobber not connected (no valid OAuth token in jobber_oauth_tokens).",
    );
  }

  const now = Date.now();
  const start = new Date(now - WINDOW_BACK_DAYS * 86_400_000).toISOString();
  const end = new Date(now + WINDOW_AHEAD_DAYS * 86_400_000).toISOString();

  // Pull every visit in the window.
  const visits: RawVisit[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res: { ok: true; data: RawVisitsPage } | JobberFetchError =
      await jobberGraphQL<RawVisitsPage>(token, VISITS_QUERY, {
        first: PAGE_SIZE,
        after: cursor,
        start,
        end,
      });
    if (!res.ok) return finish(`Jobber visits query failed: ${res.error}`);
    visits.push(...res.data.visits.edges.map((e: { node: RawVisit }) => e.node));
    if (!res.data.visits.pageInfo.hasNextPage) break;
    cursor = res.data.visits.pageInfo.endCursor;
    if (!cursor) break;
  }

  // Upsert client → project → visit per Jobber visit.
  const seenVisitIds = new Set<string>();
  for (const v of visits) {
    seenVisitIds.add(v.id);
    const client = await upsertClient(supabase, v);
    if (!client.id) continue; // visit without resolvable client — skip, next run retries
    if (client.created) summary.clientsUpserted++;
    const project = await upsertProject(supabase, v, client.id);
    if (!project.id) continue;
    if (project.created) summary.projectsUpserted++;
    if (await upsertVisit(supabase, v, project.id)) summary.visitsUpserted++;
  }

  // Soft-delete synced visits inside the window that Jobber no longer
  // returns (rescheduled out of window or deleted in Jobber). Completed
  // visits are left alone — history is history.
  const { data: stale } = await supabase
    .from("visits")
    .select("id, jobber_id")
    .not("jobber_id", "is", null)
    .is("deleted_at", null)
    .neq("status", "completed")
    .gte("scheduled_for", start)
    .lte("scheduled_for", end);
  const staleIds = (stale ?? [])
    .filter((row) => !seenVisitIds.has(row.jobber_id as string))
    .map((row) => row.id as string);
  if (staleIds.length > 0) {
    const { error } = await supabase
      .from("visits")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", staleIds);
    if (!error) summary.visitsRemoved = staleIds.length;
  }

  return finish();
}
