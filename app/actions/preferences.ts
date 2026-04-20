"use server";

/**
 * Server actions for toggling theme and language cookies. Called from the
 * inline toggle controls in the dashboard shell header and crew app.
 *
 * Both actions call revalidatePath("/", "layout") so the root layout re-runs
 * and the html lang + class attribute flip on the next render.
 */
import { revalidatePath } from "next/cache";
import { setThemePref, setLangPref } from "@/lib/preferences";

export async function toggleThemeAction(next: "light" | "dark"): Promise<void> {
  await setThemePref(next);
  revalidatePath("/", "layout");
}

export async function toggleLangAction(next: "en" | "es"): Promise<void> {
  await setLangPref(next);
  revalidatePath("/", "layout");
}
