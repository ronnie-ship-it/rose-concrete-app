import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { LangToggle } from "@/components/lang-toggle";
import { getLangPref } from "@/lib/preferences";
import { t } from "@/lib/i18n";
import { ServiceWorkerRegister } from "./sw-register";

export default async function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin can preview the crew PWA too; office is redirected to /dashboard.
  const [user, lang] = await Promise.all([
    requireRole(["crew"]),
    getLangPref(),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20 dark:bg-brand-900">
      <ServiceWorkerRegister />
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white dark:border-brand-700 dark:bg-brand-800">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/crew"
            className="text-lg font-bold text-brand-600 dark:text-white"
          >
            Rose Concrete
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle initial={lang} />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="px-4 py-6">
        <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
          {t(lang, "Signed in as")} {user.full_name ?? user.email}
        </p>
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-neutral-200 bg-white dark:border-brand-700 dark:bg-brand-800">
        <div className="mx-auto flex max-w-md items-center justify-around py-2 text-xs">
          <Link
            href="/crew"
            className="flex flex-col items-center gap-1 px-4 py-1 text-neutral-700"
          >
            <span className="text-lg">📅</span>
            <span>{t(lang, "Today")}</span>
          </Link>
          <Link
            href="/crew/schedule"
            className="flex flex-col items-center gap-1 px-4 py-1 text-neutral-700"
          >
            <span className="text-lg">🗓</span>
            <span>{t(lang, "Week")}</span>
          </Link>
          <Link
            href="/crew/upload"
            className="flex flex-col items-center gap-1 px-4 py-1 text-neutral-700"
          >
            <span className="text-lg">📷</span>
            <span>{t(lang, "Upload")}</span>
          </Link>
          <Link
            href="/crew/form"
            className="flex flex-col items-center gap-1 px-4 py-1 text-neutral-700"
          >
            <span className="text-lg">📝</span>
            <span>{t(lang, "Forms")}</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
