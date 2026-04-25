import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ServiceWorkerRegister } from "./sw-register";
import { BottomNav } from "./bottom-nav";
import { CrewTopBar } from "./top-bar";

/**
 * Crew PWA chrome — Jobber-mobile parity.
 *
 * Layout:
 *   - Sticky top bar: date on left, bell + sparkle on right.
 *   - Scrollable main content (max-w-lg so tablets don't stretch).
 *   - Fixed bottom nav: 5 tabs (Home / Schedule / Timesheet / Search
 *     / More). iOS safe-area padding baked in.
 *
 * Colors:
 *   Primary green: #1A7B40
 *   Dark text:     #1a2332
 *   Background:    #f5f5f5
 */
export default async function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin/office previews the crew PWA for QA; keeping both roles
  // enabled because prior flows depend on it.
  const user = await requireRole(["crew", "admin", "office"]);
  const supabase = await createClient();

  // Bell badge — number of unread notifications for this user.
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <div
      className="min-h-screen bg-[#f5f5f5] dark:bg-neutral-950"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 72px)",
      }}
    >
      <ServiceWorkerRegister />
      <CrewTopBar today={new Date()} unreadCount={unreadCount ?? 0} />
      <main className="mx-auto max-w-lg px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
