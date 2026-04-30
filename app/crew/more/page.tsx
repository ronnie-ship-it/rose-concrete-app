import Link from "next/link";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "More — Rose Concrete" };

/**
 * Crew "More" — Jobber mobile parity (Apr 2026 screenshots).
 *
 *   ┌──────────────────────────────────┐
 *   │  More                          ✦ │   (top-bar)
 *   │                                  │
 *   │  [logo]  Rose Concrete           │   small company logo + name
 *   │            and Development       │
 *   │                                  │
 *   │  ┌──────────┐  ┌──────────┐     │   2 big gray tiles
 *   │  │ ⊞⊕  Apps │  │ 📣 Mark- │     │
 *   │  │ &integr. │  │ eting    │     │
 *   │  └──────────┘  └──────────┘     │
 *   │                                  │
 *   │  💬  Support                     │
 *   │  📋  Subscription                │
 *   │  ✦   Product updates             │
 *   │  🎁  Refer a friend              │
 *   │  ❓  About                        │
 *   │  ─────────                       │
 *   │  👤  Profile                     │
 *   │  👥  Manage team                 │
 *   │  🏢  Company details             │
 *   │  ⚙   Preferences                  │
 *   │  ─────────                       │
 *   │  🚪  Logout                  ›   │   red text + red icon
 *   └──────────────────────────────────┘
 *
 * Rows are plain (no card grouping), separated by thin dividers.
 * Logout is the same row style but red.
 */
export default async function CrewMore() {
  const user = await requireRole(["crew", "admin", "office"]);
  const role = user.role ?? "crew";
  const isOfficeish = role === "admin" || role === "office";

  return (
    <div className="space-y-5">
      {/* Company identity — small logo + name, no shadow card */}
      <div className="flex items-center gap-3 pt-1">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-md bg-neutral-100 text-base font-extrabold text-[#1a2332] dark:bg-neutral-800 dark:text-white"
          aria-hidden="true"
        >
          {/* Tiny mock logo — green oval + "ROSE" */}
          <svg viewBox="0 0 48 48" className="h-9 w-9">
            <circle cx="24" cy="22" r="14" fill="#1A7B40" />
            <text
              x="24"
              y="26"
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              fill="#FFF"
              fontFamily="system-ui"
            >
              ROSE
            </text>
          </svg>
        </span>
        <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          Rose Concrete and Development
        </p>
      </div>

      {/* Two big gray tiles — Apps & integrations / Marketing */}
      <div className="grid grid-cols-2 gap-3">
        <BigTile
          href="/dashboard/settings/integrations"
          title="Apps & integrations"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M17 14v3M17 17h3M17 17h-3M17 17v3" />
            </svg>
          }
        />
        <BigTile
          href="/dashboard/settings/reviews"
          title="Marketing"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 11v2a4 4 0 0 0 4 4l2 4 3-1v-3l9-3V8L9 5H7a4 4 0 0 0-4 4z" />
            </svg>
          }
        />
      </div>

      {/* Group 1 — support & info */}
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
        <RowLink
          href="mailto:support@sandiegoconcrete.ai"
          label="Support"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 8v4l3 2" />
            </svg>
          }
        />
        <RowLink
          href="/dashboard/settings/workspace"
          label="Subscription"
          hidden={!isOfficeish}
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18M7 15h2M13 15h4" />
            </svg>
          }
        />
        <RowLink
          href="/dashboard/activity"
          label="Product updates"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" stroke="none">
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />
            </svg>
          }
        />
        <RowLink
          href="mailto:refer@sandiegoconcrete.ai?subject=Refer%20a%20friend"
          label="Refer a friend"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="8" width="18" height="13" rx="1" />
              <path d="M3 12h18M12 8v13M8 8a3 3 0 0 1 4-3 3 3 0 0 1 4 3" />
            </svg>
          }
        />
        <RowLink
          href="/dashboard/settings"
          label="About"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v.01M11 12h1v4h1" />
            </svg>
          }
        />
      </ul>

      {/* Group 2 — account / company / preferences */}
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
        <RowLink
          href="/dashboard/settings/team"
          label="Profile"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-3.3 3.6-6 8-6s8 2.7 8 6" />
            </svg>
          }
        />
        <RowLink
          href="/dashboard/settings/team"
          label="Manage team"
          hidden={!isOfficeish}
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3" />
              <circle cx="17" cy="9" r="2.5" />
              <path d="M3 21c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5M14 21c0-2 2-3.5 4.5-3.5s4.5 1.5 4.5 3.5" />
            </svg>
          }
        />
        <RowLink
          href="/dashboard/settings/business-profile"
          label="Company details"
          hidden={!isOfficeish}
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="1" />
              <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
            </svg>
          }
        />
        <RowLink
          href="/dashboard/settings"
          label="Preferences"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
              <circle cx="8" cy="6" r="2" fill="currentColor" />
              <circle cx="16" cy="12" r="2" fill="currentColor" />
              <circle cx="6" cy="18" r="2" fill="currentColor" />
            </svg>
          }
        />
        <RowLink
          href="/crew/more/password"
          label="Change password"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              <circle cx="12" cy="15.5" r="1" fill="currentColor" />
            </svg>
          }
        />
      </ul>

      {/* Logout — red, plain row style */}
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="flex w-full items-center gap-3 border-t border-neutral-200 py-3 text-left dark:border-neutral-700"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[#E0443C]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 17l5-5-5-5M21 12H9M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
            </svg>
          </span>
          <span className="flex-1 text-base font-bold text-[#E0443C]">
            Logout
          </span>
        </button>
      </form>

      <p className="pt-4 text-center text-[10px] text-neutral-400">
        Rose Concrete · v{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
      </p>
    </div>
  );
}

function BigTile({
  href,
  icon,
  title,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl bg-neutral-100 p-4 active:scale-[0.99] dark:bg-neutral-800"
    >
      <span className="text-[#1a2332] dark:text-white">{icon}</span>
      <p className="text-sm font-bold text-[#1a2332] dark:text-white">
        {title}
      </p>
    </Link>
  );
}

function RowLink({
  href,
  label,
  icon,
  hidden,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[48px] items-center gap-3 py-3 active:bg-neutral-50 dark:active:bg-neutral-800"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[#1a2332] dark:text-white">
          {icon}
        </span>
        <span className="flex-1 text-base font-medium text-[#1a2332] dark:text-white">
          {label}
        </span>
      </Link>
    </li>
  );
}
