import {
  PHONE_DISPLAY,
  PHONE_SMS_HREF,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";

/**
 * Sticky bottom bar — mobile only.
 *
 * Two equal-width buttons:
 *   📞 Call Now   |   💬 Text Now
 *
 * Both are real `tel:` / `sms:` hrefs so a tap dials / opens the native
 * messages app. Hidden at `md` and up because the desktop header carries
 * the same call CTA in the top-right and a sticky footer would just
 * waste real estate on bigger screens.
 *
 * The marketing layout adds a `pb-20 md:pb-0` to <body>'s child container
 * so page content can never sit underneath this bar.
 */

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function MobileCallBar() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-200 bg-white shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.08)] md:hidden"
      // Pad the bottom inset on iOS so the bar sits above the home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      role="region"
      aria-label="Quick contact"
      data-cta-placement="mobile_bar"
    >
      <div className="grid grid-cols-2 divide-x divide-brand-100">
        <a
          href={PHONE_TEL_HREF}
          className="flex h-14 items-center justify-center gap-2 bg-brand-600 font-semibold text-white transition active:bg-brand-700"
          aria-label={`Call ${PHONE_DISPLAY}`}
        >
          <PhoneIcon />
          <span>Call Now</span>
        </a>
        <a
          href={PHONE_SMS_HREF}
          className="flex h-14 items-center justify-center gap-2 bg-accent-500 font-semibold text-brand-900 transition active:bg-accent-600"
          aria-label={`Text ${PHONE_DISPLAY}`}
        >
          <ChatIcon />
          <span>Text Ronnie</span>
        </a>
      </div>
    </div>
  );
}
