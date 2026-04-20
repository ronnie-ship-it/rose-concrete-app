import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { money, dateShort } from "@/lib/format";
import { SignPad } from "./sign-pad";

export const metadata = {
  title: "Change order — Sign",
  robots: { index: false, follow: false },
};

export default async function PublicChangeOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("change_orders")
    .select(
      "id, number, title, description, additional_cost, additional_days, status, signed_name, signed_at, signature_data_url, public_token, project:projects(name, service_address, client:clients(name))",
    )
    .eq("public_token", token)
    .maybeSingle();
  if (!data) notFound();

  const order = data as unknown as {
    id: string;
    number: number;
    title: string;
    description: string | null;
    additional_cost: number;
    additional_days: number;
    status: string;
    signed_name: string | null;
    signed_at: string | null;
    signature_data_url: string | null;
    public_token: string;
    project:
      | { name: string; service_address: string | null; client: { name: string }[] | { name: string } | null }[]
      | { name: string; service_address: string | null; client: { name: string }[] | { name: string } | null }
      | null;
  };
  const project = Array.isArray(order.project) ? order.project[0] : order.project;
  const client = project
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-xl font-semibold">
          Change Order #{order.number}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">Rose Concrete</p>

        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">
            Project: <strong>{project?.name ?? "—"}</strong>
          </p>
          {project?.service_address && (
            <p className="text-sm text-neutral-500">{project.service_address}</p>
          )}
          <p className="mt-2 text-sm text-neutral-500">
            Client: <strong>{client?.name ?? "—"}</strong>
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-semibold">{order.title}</h2>
          {order.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
              {order.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
            <div>
              <p className="text-xs text-neutral-500">Added cost</p>
              <p className="text-xl font-semibold">
                {money(order.additional_cost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Added days</p>
              <p className="text-xl font-semibold">+{order.additional_days}</p>
            </div>
          </div>
        </div>

        {order.signed_at ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p>
              Signed by <strong>{order.signed_name}</strong> on{" "}
              {dateShort(order.signed_at)}.
            </p>
            {order.signature_data_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={order.signature_data_url}
                alt="Signature"
                className="mt-2 max-h-24 bg-white"
              />
            )}
          </div>
        ) : (
          <div className="mt-4">
            <SignPad token={order.public_token} />
          </div>
        )}
      </div>
    </div>
  );
}
