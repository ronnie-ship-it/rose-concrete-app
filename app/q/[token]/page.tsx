import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { money, dateShort } from "@/lib/format";
import { feeConfigFromRow } from "@/lib/payments";
import { PublicQuoteForm } from "./quote-form";

export const metadata = {
  title: "Your Rose Concrete quote",
  robots: { index: false },
};

type Params = Promise<{ token: string }>;

export default async function PublicQuotePage({ params }: { params: Params }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, number, issued_at, valid_through, scope_markdown, personal_note, deposit_percent, deposit_amount, deposit_nonrefundable, balance_terms, warranty_months, base_total, optional_total, accepted_total, status, public_token, locked_payment_method, locked_base_total, locked_fee_amount, locked_total_charged, locked_at, accepted_by_name, accepted_at, project:projects(name, location, client:clients(name))",
    )
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  // First-view stamp for the status timeline. Fire-and-forget so we
  // don't block the page render; ignore errors silently (the real
  // value is user-visible — first view time — not a business rule).
  type ViewableQuote = {
    id: string;
    viewed_at?: string | null;
  };
  const viewable = quote as unknown as ViewableQuote;
  if (!viewable.viewed_at) {
    void supabase
      .from("quotes")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", quote.id);
  }

  const project = Array.isArray(quote.project) ? quote.project[0] : quote.project;
  const client =
    project && (Array.isArray(project.client) ? project.client[0] : project.client);

  const { data: items } = await supabase
    .from("quote_line_items")
    .select(
      "id, title, description, quantity, unit, unit_price, is_optional, position, photo_id, photo:photos(id, storage_key, caption)",
    )
    .eq("quote_id", quote.id)
    .order("position", { ascending: true });

  // Mint signed URLs for any line-item photos so the customer page can
  // render them without the `photos` bucket being public.
  type Raw = {
    id: string;
    title: string;
    description: string | null;
    quantity: number | string;
    unit: string | null;
    unit_price: number | string;
    is_optional: boolean;
    position: number;
    photo_id: string | null;
    photo:
      | { id: string; storage_key: string; caption: string | null }
      | { id: string; storage_key: string; caption: string | null }[]
      | null;
  };
  const rawItems = (items ?? []) as Raw[];
  const storageKeys = rawItems
    .map((i) => {
      const p = Array.isArray(i.photo) ? i.photo[0] : i.photo;
      return p?.storage_key;
    })
    .filter((k): k is string => Boolean(k));
  const photoUrls = new Map<string, string>();
  if (storageKeys.length > 0) {
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrls(storageKeys, 60 * 60);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
    }
  }
  type Enriched = Raw & { photo_url: string | null };
  const enriched: Enriched[] = rawItems.map((i) => {
    const p = Array.isArray(i.photo) ? i.photo[0] : i.photo;
    return {
      ...i,
      photo_url: p?.storage_key
        ? photoUrls.get(p.storage_key) ?? null
        : null,
    };
  });
  const required = enriched.filter((i) => !i.is_optional);
  const optional = enriched.filter((i) => i.is_optional);

  const baseTotal = required.reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.unit_price),
    0,
  );

  // Fee config from invoice_settings (singleton). feeConfigFromRow coalesces
  // missing ACH columns to defaults so this works pre-migration-024 too.
  const { data: settings } = await supabase
    .from("invoice_settings")
    .select(
      "cc_fee_percent, cc_fee_flat_cents, cc_fee_absorb, ach_fee_percent, ach_fee_flat_cents, ach_fee_absorb",
    )
    .limit(1)
    .maybeSingle();
  const feeConfig = feeConfigFromRow(settings);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-neutral-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Rose Concrete · San Diego
        </p>
        <h1 className="mt-2 text-3xl font-bold text-neutral-900">
          Your project quote
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Quote <span className="font-mono">{quote.number}</span> · Prepared
          {client ? ` for ${client.name}` : ""} · Valid through{" "}
          {dateShort(quote.valid_through)}
        </p>
        {project && (
          <p className="mt-1 text-sm text-neutral-600">
            <strong>{project.name}</strong>
            {project.location ? ` — ${project.location}` : ""}
          </p>
        )}
      </header>

      {quote.status === "accepted" ? (
        <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-6 text-sm text-green-900">
          <p className="font-semibold">Quote accepted ✓</p>
          <p className="mt-1">
            Thank you! We've received your acceptance. Ronnie will be in touch
            shortly to confirm the schedule.
          </p>
          {quote.locked_total_charged != null && (
            <dl className="mt-3 space-y-1 rounded-md border border-green-200 bg-white/60 p-3">
              <div className="flex justify-between">
                <dt className="text-neutral-700">Signed by</dt>
                <dd className="font-medium text-neutral-900">
                  {quote.accepted_by_name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-700">Payment method</dt>
                <dd className="font-medium capitalize text-neutral-900">
                  {quote.locked_payment_method === "credit_card"
                    ? "Credit card"
                    : quote.locked_payment_method === "ach"
                      ? "ACH bank transfer"
                      : "Check"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-700">Job amount</dt>
                <dd className="font-medium text-neutral-900">
                  {money(quote.locked_base_total ?? quote.accepted_total ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-700">Fee</dt>
                <dd className="font-medium text-neutral-900">
                  {money(quote.locked_fee_amount ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-green-200 pt-1">
                <dt className="font-semibold text-neutral-900">
                  Total you pay
                </dt>
                <dd className="font-bold text-neutral-900">
                  {money(quote.locked_total_charged)}
                </dd>
              </div>
              {quote.locked_at && (
                <p className="pt-1 text-xs text-neutral-500">
                  Locked {new Date(quote.locked_at).toLocaleString()}
                </p>
              )}
            </dl>
          )}
        </div>
      ) : null}

      {quote.scope_markdown && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-900">
            Scope of work
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">
            {quote.scope_markdown}
          </p>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-neutral-900">
          What's included
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {required.length === 0 ? (
            <li className="px-4 py-3 text-sm text-neutral-500">
              No included items.
            </li>
          ) : (
            required.map((item) => (
              <li key={item.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-1 items-start gap-3">
                    {item.photo_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.photo_url}
                        alt={item.title}
                        className="h-16 w-16 shrink-0 rounded-md border border-neutral-200 object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium text-neutral-900">{item.title}</p>
                      {item.description && (
                        <p className="mt-1 text-xs text-neutral-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-neutral-900">
                    {money(Number(item.quantity) * Number(item.unit_price))}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {optional.length > 0 && quote.status !== "accepted" && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-neutral-900">
            Optional add-ons
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Check any you'd like added — your total will update automatically.
          </p>
        </section>
      )}

      <PublicQuoteForm
        token={quote.public_token}
        baseTotal={baseTotal}
        optional={optional.map((o) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          line_total: Number(o.quantity) * Number(o.unit_price),
        }))}
        depositPercent={Number(quote.deposit_percent ?? 50)}
        depositAmountOverride={
          quote.deposit_amount != null ? Number(quote.deposit_amount) : null
        }
        depositNonrefundable={quote.deposit_nonrefundable ?? true}
        warrantyMonths={quote.warranty_months ?? 36}
        balanceTerms={quote.balance_terms}
        personalNote={quote.personal_note}
        alreadyAccepted={quote.status === "accepted"}
        feeConfig={feeConfig}
      />

      <footer className="mt-10 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-500">
        Rose Concrete · Licensed & insured · San Diego County · Issued{" "}
        {dateShort(quote.issued_at)}
      </footer>
    </main>
  );
}
