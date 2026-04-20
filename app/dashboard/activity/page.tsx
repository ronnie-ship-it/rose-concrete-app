import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Activity — Rose Concrete" };

type SearchParams = Promise<{
  entity_type?: string;
  entity_id?: string;
  actor?: string;
}>;

/**
 * Activity feed. Pulls from the existing `activity_log` table. Lets
 * admin/office filter by entity type, entity id, or actor to debug what
 * happened to a record. Everyday use: just the unfiltered feed as a
 * scrollback.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "office"]);
  const { entity_type, entity_id, actor } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("activity_log")
    .select(
      "id, entity_type, entity_id, action, actor_id, payload, created_at, actor:profiles!activity_log_actor_id_fkey(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (entity_type) q = q.eq("entity_type", entity_type);
  if (entity_id) q = q.eq("entity_id", entity_id);
  if (actor) q = q.eq("actor_id", actor);

  const { data: rows, error } = await q;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity feed"
        subtitle="Every action on every record. Use the filters to scope."
      />

      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm"
      >
        <input
          name="entity_type"
          placeholder="entity type (client, project, quote...)"
          defaultValue={entity_type ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs"
        />
        <input
          name="entity_id"
          placeholder="entity id"
          defaultValue={entity_id ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-mono"
        />
        <input
          name="actor"
          placeholder="actor id"
          defaultValue={actor ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-mono"
        />
        <button
          type="submit"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
        >
          Filter
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t load activity: {error.message}
        </p>
      )}

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {(rows ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No activity matches.
          </p>
        ) : (
          (rows ?? []).map((r) => {
            const actorObj = Array.isArray(r.actor) ? r.actor[0] : r.actor;
            return (
              <div key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {r.action}
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase text-neutral-600">
                        {r.entity_type}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      by {actorObj?.full_name ?? actorObj?.email ?? "system"}
                      {" · "}
                      <code className="text-[10px]">{r.entity_id}</code>
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] text-neutral-500">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                {r.payload && Object.keys(r.payload).length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-neutral-500 hover:underline">
                      payload
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-neutral-50 p-2 text-[10px] text-neutral-700">
                      {JSON.stringify(r.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
