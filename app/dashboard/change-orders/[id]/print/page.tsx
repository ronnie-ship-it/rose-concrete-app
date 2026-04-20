import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadAttachments } from "@/lib/attachments";
import { money, dateShort } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata = { title: "Change order — Print" };

/**
 * Printable view. Plain HTML layout so the browser's "Save as PDF" produces
 * a clean single-page document. Linked from the detail page.
 */
export default async function PrintChangeOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("change_orders")
    .select(
      "id, number, title, description, additional_cost, additional_days, signed_name, signed_at, signature_data_url, created_at, project:projects(name, service_address, client:clients(name, email, phone))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const project = Array.isArray(order.project) ? order.project[0] : order.project;
  const client = project
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;

  const photos = await loadAttachments("task", order.id as string);

  const PRINT_CSS = `
    .co-print { font-family: system-ui, sans-serif; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; background: #fff; }
    .co-print h1 { margin: 0 0 4px; font-size: 24px; }
    .co-print h2 { font-size: 20px; margin-top: 24px; }
    .co-print h3 { font-size: 16px; margin-top: 16px; }
    .co-print .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
    .co-print .row { display: flex; gap: 16px; margin-bottom: 12px; }
    .co-print .card { border: 1px solid #ddd; border-radius: 6px; padding: 12px; flex: 1; }
    .co-print .label { font-size: 10px; text-transform: uppercase; color: #666; }
    .co-print .value { font-size: 14px; font-weight: 600; }
    .co-print .sig { border: 1px solid #ccc; padding: 8px; max-width: 360px; }
    .co-print .sig img { max-height: 80px; }
    .co-print .photos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .co-print .photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; }
    .co-print .totals { font-size: 18px; font-weight: 700; }
    @media print {
      .no-print { display: none !important; }
      .co-print { padding: 0; max-width: none; }
    }
  `;

  return (
    <div className="co-print">
      <style>{PRINT_CSS}</style>
      <PrintButton />

      <h1>Change Order #{order.number as number}</h1>
      <div className="meta">
        Rose Concrete · Created {dateShort(order.created_at as string)}
      </div>

      <div className="row">
        <div className="card">
          <div className="label">Project</div>
          <div className="value">{project?.name ?? "—"}</div>
          <div>{project?.service_address ?? ""}</div>
        </div>
        <div className="card">
          <div className="label">Client</div>
          <div className="value">{client?.name ?? "—"}</div>
          <div>{client?.email ?? ""}</div>
          <div>{client?.phone ?? ""}</div>
        </div>
      </div>

      <h2>{order.title as string}</h2>
      {order.description && (
        <p style={{ whiteSpace: "pre-wrap" }}>
          {order.description as string}
        </p>
      )}

      <div className="row">
        <div className="card">
          <div className="label">Added cost</div>
          <div className="totals">
            {money(order.additional_cost as number)}
          </div>
        </div>
        <div className="card">
          <div className="label">Added days</div>
          <div className="totals">+{order.additional_days as number}</div>
        </div>
      </div>

      {photos.length > 0 && (
        <>
          <h3>Photos</h3>
          <div className="photos">
            {photos.slice(0, 8).map((p) =>
              p.is_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.signed_url} alt="" />
              ) : null,
            )}
          </div>
        </>
      )}

      <h3>Signature</h3>
      {order.signature_data_url ? (
        <div className="sig">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.signature_data_url as string}
            alt="Signature"
          />
          <div>
            Signed by: {order.signed_name as string}
            {order.signed_at
              ? ` · ${dateShort(order.signed_at as string)}`
              : ""}
          </div>
        </div>
      ) : (
        <p>Not yet signed.</p>
      )}
    </div>
  );
}
