import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationBell } from "@/components/notification-bell";
import { MobileRedirect } from "@/components/mobile-redirect";
import { getThemePref } from "@/lib/preferences";
import { getTenantInfo } from "@/lib/tenant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, theme, tenant] = await Promise.all([
    requireRole(["admin", "office"]),
    getThemePref(),
    getTenantInfo(),
  ]);
  return (
    <DashboardShell
      user={user}
      theme={theme}
      tenantName={tenant?.name ?? null}
      notificationBell={<NotificationBell userId={user.id} />}
    >
      {/* Phones get bounced to /crew (Jobber-style UI). Admins on
          tablets / desktops stay here. The user can opt back into
          desktop on a phone via crew/more → "View desktop site". */}
      <MobileRedirect />
      {children}
    </DashboardShell>
  );
}
