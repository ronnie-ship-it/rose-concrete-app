import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "More — Rose Concrete" };

/**
 * Crew "More" screen — Jobber mobile parity.
 *
 *   ┌───────────────────────────────────┐
 *   │  🌹 Rose Concrete                 │   company logo + name
 *   │                                   │
 *   │  ┌───────────┐ ┌───────────┐     │   big tiles
 *   │  │   Apps    │ │ Marketing │     │
 *   │  └───────────┘ └───────────┘     │
 *   │                                   │
 *   │  Support                          │   list
 *   │  Subscription                     │
 *   │  Product updates                  │
 *   │  Refer a concrete pro             │
 *   │  About                            │
 *   │                                   │
 *   │  Profile                          │
 *   │  Manage team                      │
 *   │  Company details                  │
 *   │  Preferences                      │
 *   │                                   │
 *   │  [🚪 Log out ]                    │   red, full-width
 *   └───────────────────────────────────┘
 */
export default async function CrewMore() {
  const user = await requireRole(["crew", "admin", "office"]);
  const lang = await getLangPref();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name ?? user.full_name ?? user.email;
  const role = profile?.role ?? user.role ?? "crew";

  const isOfficeish = role === "admin" || role === "office";

  return (
    <div className="space-y-5">
      {/* Company identity */}
      <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-neutral-800">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-extrabold text-white"
          style={{ background: "#4A7C59" }}
          aria-hidden="true"
        >
          🌹
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-[#1a2332] dark:text-white">
            Rose Concrete
          </p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            Signed in as <span className="font-semibold">{displayName}</span>
          </p>
        </div>
      </div>

      {/* Big tiles — Apps + Marketing (Jobber's "App Marketplace" + "Marketing Suite") */}
      <div className="grid grid-cols-2 gap-3">
        <BigTile
          href="/dashboard/settings/integrations"
          emoji="🧩"
          title={t(lang, "Apps")}
          subtitle={t(lang, "Automations & integrations")}
        />
        <BigTile
          href="/dashboard/settings/reviews"
          emoji="📣"
          title={t(lang, "Marketing")}
          subtitle={t(lang, "Reviews, email, referrals")}
        />
      </div>

      {/* Group 1 — company-wide resources */}
      <Section label={t(lang, "Support & updates")}>
        <RowLink
          href="mailto:support@sandiegoconcrete.ai"
          label={t(lang, "Support")}
          icon="💬"
        />
        <RowLink
          href="/dashboard/settings/workspace"
          label={t(lang, "Subscription")}
          icon="💳"
          hidden={!isOfficeish}
        />
        <RowLink
          href="/dashboard/activity"
          label={t(lang, "Product updates")}
          icon="📰"
        />
        <RowLink
          href="mailto:refer@sandiegoconcrete.ai?subject=Refer%20a%20concrete%20pro"
          label={t(lang, "Refer a concrete pro")}
          icon="🎁"
        />
        <RowLink
          href="/dashboard/settings"
          label={t(lang, "About")}
          icon="ℹ️"
        />
      </Section>

      {/* Group 2 — personal + team + company settings */}
      <Section label={t(lang, "Account")}>
        <RowLink
          href="/dashboard/settings/team"
          label={t(lang, "Profile")}
          icon="👤"
        />
        <RowLink
          href="/dashboard/settings/team"
          label={t(lang, "Manage team")}
          icon="👥"
          hidden={!isOfficeish}
        />
        <RowLink
          href="/dashboard/settings/business-profile"
          label={t(lang, "Company details")}
          icon="🏢"
          hidden={!isOfficeish}
        />
        <RowLink
          href="/dashboard/settings"
          label={t(lang, "Preferences")}
          icon="⚙️"
        />
      </Section>

      {/* Log out — red, prominent */}
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-[#E0443C] shadow-sm active:bg-neutral-50 dark:bg-neutral-800"
        >
          <span>🚪</span>
          <span>{t(lang, "Log out")}</span>
        </button>
      </form>

      <p className="pt-4 text-center text-[10px] text-neutral-400">
        Rose Concrete · v{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </h2>
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-neutral-700 dark:bg-neutral-800">
        {children}
      </ul>
    </section>
  );
}

function BigTile({
  href,
  emoji,
  title,
  subtitle,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl bg-white p-4 shadow-sm active:scale-[0.99] dark:bg-neutral-800"
    >
      <span className="text-2xl">{emoji}</span>
      <p className="text-sm font-extrabold text-[#1a2332] dark:text-white">
        {title}
      </p>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        {subtitle}
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
  icon: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[48px] items-center gap-3 px-4 py-3 active:bg-neutral-50 dark:active:bg-neutral-700"
      >
        <span className="w-6 text-center text-base">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-[#1a2332] dark:text-white">
          {label}
        </span>
        <span className="text-neutral-400">›</span>
      </Link>
    </li>
  );
}
