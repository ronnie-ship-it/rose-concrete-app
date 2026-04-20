import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * In-app notification bell. Renders the unread count + a dropdown of
 * the last 10 notifications for the current user. Mark-read happens on
 * click via the /dashboard/notifications page (link).
 *
 * Server component — always fresh on each navigation. No subscription;
 * we're not that online yet. Ronnie sees it update when he moves pages.
 */
export async function NotificationBell({ userId }: { userId: string }) {
  // Wrap the whole query in try/catch — some Supabase client error modes
  // (session refresh failure, transport error) THROW rather than returning
  // {error}. Without this guard, those throws would bubble up and 500 the
  // dashboard layout, which every dashboard page inherits.
  let rows: Array<{
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }> | null = null;
  try {
    const supabase = await createClient();
    const res = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (res.error) throw new Error(res.error.message);
    rows = res.data;
  } catch (err) {
    console.error("[notification-bell] query failed:", err);
  }

  // Graceful fallback when the query couldn't run — render an empty bell
  // instead of 500ing the whole dashboard.
  if (rows === null) {
    return (
      <Link
        href="/dashboard/notifications"
        className="relative rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100"
        title="Notifications"
      >
        🔔
      </Link>
    );
  }

  const unread = (rows ?? []).filter((r) => !r.read_at).length;

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-neutral-700 hover:bg-neutral-100">
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-md border border-neutral-200 bg-white p-2 shadow-lg">
        <div className="flex items-center justify-between px-2 py-1 text-xs">
          <span className="font-semibold text-brand-700">Notifications</span>
          <Link
            href="/dashboard/notifications"
            className="text-neutral-500 hover:underline"
          >
            See all →
          </Link>
        </div>
        {(rows ?? []).length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-neutral-500">
            Nothing new.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {(rows ?? []).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link ?? "/dashboard/notifications"}
                  className={`block rounded-md px-2 py-1.5 text-xs transition hover:bg-neutral-50 ${
                    n.read_at ? "opacity-60" : "bg-brand-50/40"
                  }`}
                >
                  <p className="font-semibold text-neutral-900">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-neutral-600">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
