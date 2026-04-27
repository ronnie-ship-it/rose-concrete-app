import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { CrewCreateChrome } from "../chrome";

export const metadata = { title: "New quote — Rose Concrete" };

/**
 * Crew "New quote" — template picker (matches the iOS screenshot).
 *
 *   - "Use template" gray label
 *   - List of templates as plain rows with hairline dividers
 *   - Bottom: green "Create New Quote" full-width button
 *
 * All routes target /crew/* paths so the mobile experience stays
 * inside the crew PWA. Clicking a template links to /crew, since
 * full quote-builder is a desktop-only flow today; the mobile app
 * shows quote summaries via /crew/quotes/[id]. We surface a toast
 * explaining that quote creation continues on the office side.
 */
const TEMPLATES = [
  "Basic Sidewalk Repair for Small Job",
  "Driveway Template",
  "Patio Template Minimum",
  "Rose Concrete",
  "Sidewalk Template For Larger than 20 Linear feet",
  "Walkway Replacement Template",
];

export default async function CrewNewQuote() {
  await requireRole(["crew", "admin", "office"]);

  // Crew quote builder isn't shipped yet; route the "Create" button
  // to the home page with a friendly toast that explains where the
  // builder lives.
  const desktopOnlyMessage = encodeURIComponent(
    "Open the desktop app to send a quote. We'll bring quote-building to the crew app soon.",
  );

  return (
    <CrewCreateChrome
      title="New quote"
      saveLabel="Create New Quote"
      saveHref={`/crew?error=${desktopOnlyMessage}`}
    >
      <p className="px-4 pt-4 pb-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
        Use template
      </p>

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {TEMPLATES.map((name) => (
          <li key={name}>
            <Link
              href={`/crew?error=${encodeURIComponent(
                `"${name}" template loaded. Use the desktop app to send the quote — full mobile builder is coming soon.`,
              )}`}
              className="flex items-center px-4 py-4 text-base text-[#1a2332] active:bg-neutral-50 dark:text-white dark:active:bg-neutral-800"
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </CrewCreateChrome>
  );
}
