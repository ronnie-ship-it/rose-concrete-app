"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky trust bar — sits directly under the marketing header.
 *
 * Visible by default. Hides on scroll DOWN past 200px (gives the user
 * full reading area for body content). Reappears immediately on scroll
 * UP so it's always one finger-flick away.
 *
 * Single line of trust signals: rating, veteran-owned, license, free
 * quotes, response time. Single line so it doesn't visually compete
 * with the header's call CTA — its job is reinforcement, not capture.
 */

const SCROLL_HIDE_THRESHOLD = 200;

const SIGNALS = [
  { icon: "stars", text: "★★★★★ 5.0 Rated" },
  { icon: null, text: "Veteran-Owned" },
  { icon: null, text: "CA License #1130763" },
  { icon: null, text: "Free Quotes" },
  { icon: "lightning", text: "Same-Day Response" },
];

export function StickyTrustBar() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < SCROLL_HIDE_THRESHOLD) {
          // Always show near the top.
          setVisible(true);
        } else if (y > lastY + 4) {
          // Scrolling down a non-trivial amount — hide.
          setVisible(false);
        } else if (y < lastY - 4) {
          // Scrolling up — show.
          setVisible(true);
        }
        lastY = y;
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        // Sits under the sticky header (z-30 < header's z-40).
        "sticky top-16 z-30 border-b border-brand-100 bg-brand-50/95 backdrop-blur",
        "transition-transform duration-200 ease-out",
        visible ? "translate-y-0" : "-translate-y-full",
        "sm:top-20",
      )}
    >
      <div className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
        <ul className="flex min-w-max items-center justify-center gap-x-4 gap-y-1 py-1.5 text-[11px] font-semibold text-brand-800 sm:gap-x-6 sm:py-2 sm:text-xs">
          {SIGNALS.map((s, i) => (
            <li key={s.text} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden="true" className="text-brand-300">·</span>
              )}
              {s.icon === "stars" && (
                <span aria-hidden="true" className="text-accent-600">
                  {s.text}
                </span>
              )}
              {s.icon === "lightning" && (
                <span className="flex items-center gap-1">
                  <span aria-hidden="true" className="text-accent-600">⚡</span>
                  {s.text}
                </span>
              )}
              {!s.icon && <span>{s.text}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
