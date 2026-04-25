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
 * Tapping a template routes into /dashboard/quotes/quick with the
 * template name pre-filled. "Create New Quote" starts a blank quote.
 *
 * Note: templates are static for now — the Jobber list ships with
 * Ronnie's actual templates (Driveway, Sidewalk, Patio, etc.). When
 * we wire a `quote_templates` table this becomes a DB query.
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

  return (
    <CrewCreateChrome
      title="New quote"
      saveLabel="Create New Quote"
      saveHref="/dashboard/quotes/quick"
    >
      <p className="px-4 pt-4 pb-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
        Use template
      </p>

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {TEMPLATES.map((name) => (
          <li key={name}>
            <Link
              href={`/dashboard/quotes/quick?template=${encodeURIComponent(name)}`}
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
