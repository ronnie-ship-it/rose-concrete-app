/**
 * Per-user UI preferences stored in cookies.
 *
 * Cookies picked over Supabase rows because:
 *   1. They're read in the root layout — a DB round-trip on every SSR render
 *      is wasteful for something this small.
 *   2. They work for unauthenticated /q/[token] quote-approval visitors too,
 *      so the customer-facing pages respect their device preference.
 *
 * If/when we want cross-device sync, move to a user_preferences table and
 * keep the cookie as a fallback.
 */
import { cookies } from "next/headers";

export type ThemePref = "light" | "dark";
export type LangPref = "en" | "es";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getThemePref(): Promise<ThemePref> {
  const store = await cookies();
  return store.get("theme")?.value === "dark" ? "dark" : "light";
}

export async function getLangPref(): Promise<LangPref> {
  const store = await cookies();
  return store.get("lang")?.value === "es" ? "es" : "en";
}

export async function setThemePref(next: ThemePref): Promise<void> {
  const store = await cookies();
  store.set("theme", next, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}

export async function setLangPref(next: LangPref): Promise<void> {
  const store = await cookies();
  store.set("lang", next, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
