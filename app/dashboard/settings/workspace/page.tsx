import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { getTenantInfo } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceForm } from "./form";

export const metadata = { title: "Workspace — Rose Concrete" };

/**
 * Per-tenant workspace settings. Today: rename the workspace,
 * view plan + trial status, view teammates. Future: invite link,
 * billing, tenant-level branding.
 *
 * Admin-only — office/crew can see the dashboard but can't rename
 * the workspace.
 */
export default async function WorkspaceSettingsPage() {
  await requireRole(["admin"]);
  const tenant = await getTenantInfo();
  if (!tenant) redirect("/login");

  const supabase = await createClient();
  const { data: teammates } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace"
        subtitle={`${tenant.name} · ${tenant.plan} plan · ${tenant.status}`}
      />
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
          Workspace details
        </h2>
        <WorkspaceForm
          initial={{ name: tenant.name, slug: tenant.slug ?? "" }}
        />
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
          Teammates ({teammates?.length ?? 0})
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Every member of this workspace. Invite flow lives at Settings
          → Team.
        </p>
        <ul className="divide-y divide-neutral-100 dark:divide-brand-700">
          {(teammates ?? []).map((u) => (
            <li
              key={u.id as string}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  {(u.full_name as string | null) ?? (u.email as string)}
                </p>
                <p className="text-xs text-neutral-500">{u.email as string}</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-brand-700 dark:text-neutral-200">
                {u.role as string}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          Plan
        </h2>
        <p className="text-xs text-neutral-500">
          You&apos;re on the <strong>{tenant.plan}</strong> plan
          ({tenant.status}
          {tenant.trial_ends_at
            ? ` — trial ends ${new Date(tenant.trial_ends_at).toLocaleDateString()}`
            : ""}
          ). Billing and upgrades are a separate round; for now plan =
          display only.
        </p>
      </Card>
    </div>
  );
}
