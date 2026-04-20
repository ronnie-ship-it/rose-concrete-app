import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { money, dateShort } from "@/lib/format";
import { QuoteMetaForm } from "./meta-form";
import { QuoteTimeline } from "./timeline";
import { LineItemList } from "./line-items";
import {
  updateQuoteMetaAction,
  markQuoteSentAction,
  deleteQuoteAction,
  convertQuoteToJobAction,
  createSimilarQuoteAction,
} from "../actions";
import { QuoteActions } from "./quote-actions";
import { QuoteMoreMenu } from "./more-menu";
import { NotesPanel } from "@/components/notes-panel";
import { loadNotes } from "@/lib/notes-server";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { loadAttachments } from "@/lib/attachments";
import { CustomFieldsPanel } from "@/components/custom-fields/panel";
import { loadCustomFieldsFor } from "@/lib/custom-fields";
import { SmartEstimateChip } from "@/components/smart-estimate-chip";

export const metadata = { title: "Quote — Rose Concrete" };

type Params = Promise<{ id: string }>;

export default async function QuoteEditorPage({ params }: { params: Params }) {
  await requireRole(["admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "*, project:projects(id, name, service_type, sqft, client:clients(id, name, email))"
    )
    .eq("id", id)
    .single();
  if (!quote) notFound();

  const { data: items } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", id)
    .order("position", { ascending: true });

  const { data: photos } = await supabase
    .from("photos")
    .select("id, caption, storage_key")
    .order("created_at", { ascending: false })
    .limit(100);

  // Templates for the "Insert from library" picker. Swallow errors so
  // the quote editor still renders if migration 011 hasn't been run.
  const { data: templates } = await supabase
    .from("line_item_templates")
    .select("id, title, description, unit, unit_price, default_quantity")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  // Profiles for salesperson dropdown.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["admin", "office"])
    .order("full_name", { ascending: true });

  const project = Array.isArray(quote.project) ? quote.project[0] : quote.project;
  const client =
    project && (Array.isArray(project.client) ? project.client[0] : project.client);

  const baseTotal = Number(quote.base_total ?? 0);
  const optionalTotal = Number(quote.optional_total ?? 0);
  const grandTotal = baseTotal + optionalTotal;

  const updateMeta = updateQuoteMetaAction.bind(null, id);
  const markSent = markQuoteSentAction.bind(null, id);
  const del = deleteQuoteAction.bind(null, id);
  const convertToJob = convertQuoteToJobAction.bind(null, id);
  const createSimilar = createSimilarQuoteAction.bind(null, id);

  const publicUrl = `/q/${quote.public_token}`;
  const notes = await loadNotes("quote", id);
  const attachments = await loadAttachments("quote", id);
  const customFields = await loadCustomFieldsFor("quote", id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/quotes"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Quotes
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-bold text-neutral-900">
              {quote.number}
            </h1>
            <p className="text-sm text-neutral-600">
              {project && (
                <>
                  Project:{" "}
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    {project.name}
                  </Link>
                </>
              )}
              {client && (
                <>
                  {" "}· Client:{" "}
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    {client.name}
                  </Link>
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Issued {dateShort(quote.issued_at)} · Valid through{" "}
              {dateShort(quote.valid_through)} · Status{" "}
              <strong>{quote.status}</strong>
            </p>
            <QuoteTimeline
              created={quote.issued_at as string | null}
              sent={quote.sent_at as string | null}
              viewed={quote.viewed_at as string | null}
              approved={quote.accepted_at as string | null}
              converted={quote.converted_at as string | null}
              declined={quote.declined_at as string | null}
              expired={quote.expired_at as string | null}
              status={quote.status}
            />
          </div>
          <div className="flex items-start gap-2">
            <QuoteActions
              publicUrl={publicUrl}
              status={quote.status}
              markSent={markSent}
              del={del}
              convertToJob={convertToJob}
              createSimilar={createSimilar}
              quoteNumber={quote.number}
            />
            <QuoteMoreMenu quoteId={id} publicUrl={publicUrl} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Line items
            </h2>
            <LineItemList
              quoteId={id}
              items={items ?? []}
              photos={photos ?? []}
              templates={(templates ?? []) as unknown as Array<{
                id: string;
                title: string;
                description: string | null;
                unit: string;
                unit_price: number | string;
                default_quantity: number | string;
              }>}
            />
          </section>

          {/* Smart estimate — suggests price + flags outliers based
              on completed jobs of the same service_type + sqft bucket.
              Renders nothing when there's no history yet. */}
          <SmartEstimateChip
            serviceType={(project?.service_type as string | null) ?? null}
            sqft={Number(project?.sqft ?? 0) || null}
            proposedPrice={grandTotal}
          />

          <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Scope, terms & deposit
            </h2>
            <QuoteMetaForm
              action={updateMeta}
              initial={quote}
              profiles={profiles ?? []}
            />
          </section>

          {customFields.length > 0 && (
            <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Custom fields
              </h2>
              <CustomFieldsPanel
                entityType="quote"
                entityId={id}
                rows={customFields}
              />
            </section>
          )}

          <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Notes
            </h2>
            <NotesPanel entityType="quote" entityId={id} notes={notes} />
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <AttachmentsPanel
              entityType="quote"
              entityId={id}
              attachments={attachments}
            />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Totals
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600">Base</dt>
                <dd className="font-medium">{money(baseTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Optional add-ons</dt>
                <dd className="font-medium">{money(optionalTotal)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base">
                <dt className="font-semibold text-neutral-900">
                  If client picks all
                </dt>
                <dd className="font-bold text-neutral-900">
                  {money(grandTotal)}
                </dd>
              </div>
              {quote.accepted_total != null && (
                <div className="flex justify-between text-green-700">
                  <dt>Accepted total</dt>
                  <dd className="font-bold">{money(quote.accepted_total)}</dd>
                </div>
              )}
            </dl>
            {quote.locked_payment_method && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <p className="font-semibold uppercase tracking-wide text-emerald-700">
                  Payment locked at signing
                </p>
                <dl className="mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <dt>Method</dt>
                    <dd className="font-medium capitalize">
                      {quote.locked_payment_method === "credit_card"
                        ? "Credit card"
                        : quote.locked_payment_method === "ach"
                          ? "ACH bank transfer"
                          : "Check"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Job amount</dt>
                    <dd>{money(quote.locked_base_total ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Fee</dt>
                    <dd>{money(quote.locked_fee_amount ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-emerald-200 pt-1">
                    <dt className="font-semibold">Total charged</dt>
                    <dd className="font-bold">
                      {money(quote.locked_total_charged ?? 0)}
                    </dd>
                  </div>
                  {quote.locked_at && (
                    <p className="pt-1 text-[11px] text-emerald-700">
                      {quote.accepted_by_name
                        ? `Signed by ${quote.accepted_by_name} · `
                        : ""}
                      {new Date(quote.locked_at).toLocaleString()}
                    </p>
                  )}
                </dl>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Public client link
            </h2>
            <p className="mt-2 break-all text-xs text-neutral-600">
              {publicUrl}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Send this link to {client?.name ?? "the client"}. They can toggle
              optional add-ons and accept the quote in their browser.
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              DocuSign
            </h2>
            <p className="mt-2 text-xs text-neutral-500">
              Status: <strong>{quote.docusign_status}</strong>
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Auto-send fires on accept once <code>docusign_auto_send</code> is
              flipped on and the template ID is wired in.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
