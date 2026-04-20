import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, StatusPill } from "@/components/ui";
import { dateShort } from "@/lib/format";
import { ReviewRowActions } from "./review-row-actions";

export const metadata = { title: "Import review — Rose Concrete" };

type Suggestion = { id: string; name: string; reason: string; distance: number };

type Row = {
  id: string;
  kind: string;
  row_number: number | null;
  raw: Record<string, string>;
  payload: Record<string, unknown>;
  reason: string;
  suggestions: Suggestion[];
  status: string;
  created_at: string;
  resolved_entity_id: string | null;
};

export default async function ImportReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole(["admin", "office"]);
  const { status } = await searchParams;
  const view = status ?? "pending";

  const supabase = await createClient();
  let builder = supabase
    .from("import_review_rows")
    .select(
      "id, kind, row_number, raw, payload, reason, suggestions, status, created_at, resolved_entity_id",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (view !== "all") builder = builder.eq("status", view);

  const { data: rowsRaw } = await builder;
  const rows = (rowsRaw ?? []) as unknown as Row[];

  // Pull every candidate client once so the suggestion dropdown can show
  // the full list as a fallback for rows where Levenshtein picked nothing.
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");
  const clientList = (clients ?? []) as Array<{ id: string; name: string }>;

  const counts = await Promise.all([
    supabase
      .from("import_review_rows")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("import_review_rows")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved"),
    supabase
      .from("import_review_rows")
      .select("id", { count: "exact", head: true })
      .eq("status", "dismissed"),
  ]);

  const pendingCount = counts[0].count ?? 0;
  const resolvedCount = counts[1].count ?? 0;
  const dismissedCount = counts[2].count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import review"
        subtitle="Jobber rows that couldn't auto-match a client/project. Pick the right one from the suggestions or from the full client list."
      />

      <div className="flex flex-wrap gap-1.5">
        <FilterPill
          href="/dashboard/settings/import-review"
          label={`Pending (${pendingCount})`}
          active={view === "pending"}
        />
        <FilterPill
          href="/dashboard/settings/import-review?status=resolved"
          label={`Resolved (${resolvedCount})`}
          active={view === "resolved"}
        />
        <FilterPill
          href="/dashboard/settings/import-review?status=dismissed"
          label={`Dismissed (${dismissedCount})`}
          active={view === "dismissed"}
        />
        <FilterPill
          href="/dashboard/settings/import-review?status=all"
          label="All"
          active={view === "all"}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            Nothing {view === "pending" ? "pending review" : `in ${view}`}.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={r.kind} />
                    <p className="text-xs text-neutral-500">
                      Row {r.row_number ?? "?"} · {dateShort(r.created_at)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-neutral-900">
                    {r.reason}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    <strong>Raw client:</strong>{" "}
                    <span className="font-mono">
                      {String(
                        (r.payload?.client_name as string) ??
                          (r.raw?.client_name as string) ??
                          "—",
                      )}
                    </span>
                  </p>
                  {typeof r.payload?.name === "string" && (
                    <p className="text-xs text-neutral-600">
                      <strong>Project:</strong>{" "}
                      <span className="font-mono">
                        {r.payload.name as string}
                      </span>
                    </p>
                  )}
                  {typeof r.payload?.external_id === "string" && (
                    <p className="text-xs text-neutral-600">
                      <strong>Job #:</strong>{" "}
                      <span className="font-mono">
                        {r.payload.external_id as string}
                      </span>
                    </p>
                  )}
                </div>
                <StatusPill
                  status={r.status}
                  tone={
                    r.status === "resolved"
                      ? "success"
                      : r.status === "dismissed"
                        ? "neutral"
                        : "warning"
                  }
                />
              </div>

              {r.status === "pending" && (
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  {r.suggestions && r.suggestions.length > 0 ? (
                    <p className="mb-2 text-xs font-medium text-neutral-700">
                      Did you mean:
                    </p>
                  ) : (
                    <p className="mb-2 text-xs text-neutral-500">
                      No close matches found. Pick from the full client
                      list below.
                    </p>
                  )}
                  <ReviewRowActions
                    reviewId={r.id}
                    kind={r.kind}
                    suggestions={r.suggestions ?? []}
                    clients={clientList}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  // Can't use next/link in a server component that passes a Link here
  // without importing it; use plain <a> so page stays small.
  return (
    <a
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300"
      }`}
    >
      {label}
    </a>
  );
}
