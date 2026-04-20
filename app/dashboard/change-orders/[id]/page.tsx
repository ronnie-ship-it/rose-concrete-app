import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, StatusPill, SecondaryButton } from "@/components/ui";
import { dateShort, money } from "@/lib/format";
import { loadAttachments } from "@/lib/attachments";
import { StatusActions } from "./status-actions";
import { PhotoUploader } from "./photo-uploader";

export const metadata = { title: "Change order — Rose Concrete" };

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "office"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("change_orders")
    .select(
      "id, number, title, description, status, additional_cost, additional_days, signed_name, signed_at, signature_data_url, public_token, created_at, project:projects(id, name, service_address, client:clients(id, name, email))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const order = row as unknown as {
    id: string;
    number: number;
    title: string;
    description: string | null;
    status: string;
    additional_cost: number;
    additional_days: number;
    signed_name: string | null;
    signed_at: string | null;
    signature_data_url: string | null;
    public_token: string | null;
    created_at: string;
    project:
      | {
          id: string;
          name: string;
          service_address: string | null;
          client: { id: string; name: string; email: string | null }[] | { id: string; name: string; email: string | null } | null;
        }[]
      | {
          id: string;
          name: string;
          service_address: string | null;
          client: { id: string; name: string; email: string | null }[] | { id: string; name: string; email: string | null } | null;
        }
      | null;
  };
  const project = Array.isArray(order.project) ? order.project[0] : order.project;
  const client = project
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;

  const photos = await loadAttachments("task", order.id);

  const publicUrl = order.public_token
    ? `${process.env.APP_BASE_URL ?? ""}/change-order/${order.public_token}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Change order #${order.number}`}
        subtitle={order.title}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={order.status} />
            <Link
              href={`/dashboard/change-orders/${order.id}/print`}
              target="_blank"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Print / PDF
            </Link>
            {project && (
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="text-xs text-brand-700 hover:underline"
              >
                Back to project
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="text-xs font-semibold uppercase text-neutral-500">
            Project
          </h3>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {project?.name ?? "—"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{project?.service_address ?? ""}</p>
          <p className="mt-2 text-sm text-neutral-700">{client?.name ?? ""}</p>
        </Card>
        <Card>
          <h3 className="text-xs font-semibold uppercase text-neutral-500">
            Added cost
          </h3>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            {money(order.additional_cost)}
          </p>
          <p className="text-xs text-neutral-500">
            +{order.additional_days} day{order.additional_days === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <h3 className="text-xs font-semibold uppercase text-neutral-500">
            Status
          </h3>
          <p className="mt-1 text-sm text-neutral-700">
            Created {dateShort(order.created_at)}
          </p>
          {order.signed_at && (
            <p className="text-xs text-emerald-700">
              Signed by {order.signed_name} · {dateShort(order.signed_at)}
            </p>
          )}
          <StatusActions id={order.id} current={order.status} />
        </Card>
      </div>

      {order.description && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">
            Description
          </h3>
          <p className="whitespace-pre-wrap text-sm text-neutral-700">
            {order.description}
          </p>
        </Card>
      )}

      {publicUrl && (
        <Card>
          <h3 className="text-sm font-semibold text-neutral-900">
            Customer sign link
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Text or email this link to the customer. They can sign with their
            finger on a phone.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
              {publicUrl}
            </code>
            <SecondaryButton
              type="button"
              onClick={() => {}}
              className="pointer-events-none opacity-60"
            >
              Copy on the public page
            </SecondaryButton>
          </div>
          {!process.env.APP_BASE_URL && (
            <p className="mt-2 text-xs text-amber-700">
              Set <code>APP_BASE_URL</code> for shareable links.
            </p>
          )}
        </Card>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Photos
        </h3>
        <PhotoUploader changeOrderId={order.id} />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <a
              key={p.id}
              href={p.signed_url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded border border-neutral-200"
            >
              {p.is_image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.signed_url}
                  alt={p.filename}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-neutral-100 text-xs text-neutral-500">
                  {p.filename}
                </div>
              )}
            </a>
          ))}
          {photos.length === 0 && (
            <p className="col-span-full text-sm text-neutral-500">
              No photos yet.
            </p>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Signature
        </h3>
        <Card>
          {order.signature_data_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={order.signature_data_url}
              alt="Signature"
              className="max-h-32 border border-neutral-200 bg-white"
            />
          ) : (
            <p className="text-sm text-neutral-500">Not yet signed.</p>
          )}
        </Card>
      </section>

    </div>
  );
}
