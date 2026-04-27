"use client";

/**
 * Bounce admin / office users to the crew app when they hit the
 * dashboard ROOT on a small viewport. Phones get the Jobber-style
 * mobile UI; desktops keep the heavy dashboard.
 *
 *   /dashboard          → /crew  (on mobile)
 *   /dashboard/<sub>    → left alone — the user navigated there
 *                          deliberately (search result, deep link,
 *                          email button, etc.). We'd rather show a
 *                          desktop-styled detail page on a phone than
 *                          bounce them in a loop.
 *
 * The breakpoint matches Tailwind's `md` (≥768 px). On a desktop
 * window resized below that the user gets bumped from /dashboard
 * root the next time they land there.
 *
 * Persists a `localStorage` flag when the user explicitly chooses to
 * view the desktop version on a phone (set from /crew/more →
 * "View desktop site"), so we don't fight them.
 */
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const MOBILE_BREAKPOINT = 768;
const FORCE_DESKTOP_KEY = "rc:force-desktop";

export function MobileRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Respect user's explicit "stay on desktop" preference.
    if (localStorage.getItem(FORCE_DESKTOP_KEY) === "1") return;
    // Only fire on /dashboard root — leave detail subroutes alone so
    // a search-result tap on a phone still opens the page the user
    // asked for instead of looping back to /crew home.
    if (pathname !== "/dashboard") return;

    function check() {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        router.replace("/crew");
      }
    }

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [router, pathname]);

  return null;
}
