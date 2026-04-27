import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { money } from "@/lib/format";
import { CrewCreateChrome } from "../../create/chrome";

export const metadata = { title: "Quote — Rose Concrete" };

type Params = Promise<{ id: string }>;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting response",
  accepted: "Approved",
  declined: "Declined",
  expired: "Expired",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-700",
  sent: "bg-amber-100 text-amber-800",
  accepted: "bg-[#1A7B40]/15 text-[#1A7B40]",
  declined: "bg-red-100 text-red-700",
  expired: "bg-neutral-200 text-neutral-700",
};

/**
 * Crew-app quote detail. Read-only summary with line items + total.
 * Used as the destination for:
 *   - search result rows (quote kind)
 *   - the "Quotes" list on /crew/clients/[id]
 *
 * Crew can see what was quoted and how much; deeper edits + sending
 * still happen on /dashboard/quotes/[id].
 */
export default async function CrewQuoteDetail({ params }: { params: Params }) {
  await requireRole(["crew", "admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `id, number, status, base_total, optional_total, accepted_total,
       issued_at, valid_through,
       project:projects(
         id, name,
         client:clients(id, name)
       )`,
    )
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const { data: lineItems } = await supabase
    .from("quote_line_items")
    .select(
      "id, title, description, quantity, unit, unit_price, line_total, is_optional, is_selected",
    )
    .eq("quote_id", id)
    .order("position", { ascending: true });

  const project = Array.isArray(quote.project) ? quote.project[0] : quote.project;
  const client = project?.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;

  const total = Number(
    quote.accepted_total ??
      Number(quote.base_total ?? 0) + Number(quote.optional_total ?? 0),
  );
  const status = (quote.status as string) ?? "draft";

  return (
    <CrewCreateChrome title={`Quote #${quote.number}`} saveLabel="Done" saveHref="/crew">
      <div className="px-4 pt-4">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
            STATUS_COLOR[status] ?? STATUS_COLOR.draft
          }`}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
        <h1 className="mt-2 text-xl font-extrabold text-[#1a2332] dark:text-white">
          {project?.name ?? "Quote"}
        </h1>
        {client && (
          <Link
            href={`/crew/clients/${client.id}`}
            className="mt-1 block text-sm font-semibold text-[#1A7B40]"
          >
            {client.name}
          </Link>
        )}
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {quote.issued_at
            ? `Issued ${new Date(quote.issued_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`
            : "Not yet sent"}
          {quote.valid_through &&
            ` · Valid through ${new Date(quote.valid_through).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )}`}
        </p>
      </div>

      <div className="mt-5 px-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Line items
        </h2>
        {!lineItems || lineItems.length === 0 ? (
          <div className="rounded-xl bg-white p-4 text-sm text-neutral-500 shadow-sm dark:bg-neutral-800 dark:text-neutral-400">
            No line items on this quote.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
            {lineItems.map((li) => (
              <li
                key={li.id}
                className={`flex items-start gap-3 px-4 py-3 ${
                  li.is_selected === false ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#1a2332] dark:text-white">
                    {li.title}
                    {li.is_optional && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                        Optional
                      </span>
                    )}
                  </p>
                  {li.description && (
                    <p className="mt-0.5 line-clamp-3 text-xs text-neutral-500 dark:text-neutral-400">
                      {li.description}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {Number(li.quantity)} {li.unit ?? "job"} ·{" "}
                    {money(Number(li.unit_price ?? 0))}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-[#1a2332] dark:text-white">
                  {money(Number(li.line_total ?? 0))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals */}
      <div className="mt-4 px-4 pb-8">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-neutral-800">
          <div className="flex items-center justify-between bg-[#1a2332] px-4 py-3 text-white">
            <span className="text-sm font-bold">Total</span>
            <span className="text-lg font-extrabold tabular-nums">
              {money(total)}
            </span>
          </div>
        </div>
      </div>
    </CrewCreateChrome>
  );
}
