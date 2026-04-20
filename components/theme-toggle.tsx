"use client";

/**
 * Small toggle button that flips the theme cookie + html class. We also flip
 * the class optimistically on the client so the transition is instant; the
 * server-side revalidate keeps the cookie + SSR-rendered class in sync.
 */
import { useTransition } from "react";
import { toggleThemeAction } from "@/app/actions/preferences";

export function ThemeToggle({ initial }: { initial: "light" | "dark" }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = initial === "dark" ? "light" : "dark";
    // Optimistic: flip the class on <html> immediately.
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    startTransition(async () => {
      await toggleThemeAction(next);
    });
  }

  const label = initial === "dark" ? "Light mode" : "Dark mode";
  const icon = initial === "dark" ? "☀" : "☾";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-brand-800 dark:text-neutral-100 dark:hover:bg-brand-700"
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
