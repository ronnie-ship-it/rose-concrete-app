"use client";

/**
 * Bounce admin / office users to the crew app when they hit a
 * dashboard page on a small viewport. Phones get the Jobber-style
 * mobile UI; desktops keep the heavy dashboard.
 *
 * The breakpoint matches Tailwind's `md` (≥768 px). On a desktop
 * window resized below that the user also gets bumped — that's
 * deliberate, the dashboard layout breaks down well below 768.
 *
 * One-shot only — once we're on /crew the component never mounts
 * again. The user can return to /dashboard manually from /crew/more
 * if they want to (e.g. on a tablet they're holding landscape).
 *
 * Persists a `localStorage` flag when the user explicitly chooses
 * to view the desktop version on a phone, so we don't fight them.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MOBILE_BREAKPOINT = 768;
const FORCE_DESKTOP_KEY = "rc:force-desktop";

export function MobileRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Respect user's explicit "stay on desktop" preference.
    if (localStorage.getItem(FORCE_DESKTOP_KEY) === "1") return;

    function check() {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        router.replace("/crew");
      }
    }

    // Run once on mount, and again on resize (rotate phone, browser
    // window resize on a tablet, etc.).
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [router]);

  return null;
}
