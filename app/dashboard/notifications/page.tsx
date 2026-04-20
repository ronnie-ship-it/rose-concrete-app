import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications — Rose Concrete" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  // Mark everything read on view — side effect of being here.
  const service = createServiceRoleClient();
  await service
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${(rows ?? []).length} total · marking unread as read now`}
      />
      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {(rows ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No notifications yet.
          </p>
        ) : (
          (rows ?? []).map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              className={`block px-4 py-3 text-sm transition hover:bg-neutral-50 ${
                n.read_at ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-900">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-neutral-600">{n.body}</p>
                  )}
                </div>
                <p className="shrink-0 text-[11px] text-neutral-500">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
