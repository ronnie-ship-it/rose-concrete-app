/**
 * Recent projects shown in <RecentProjects />.
 *
 * Every entry is a placeholder. Ronnie should:
 *   1. Pick six recent jobs with photos he likes.
 *   2. Save each photo to /public/marketing/projects/<filename>.jpg
 *      (matching the `imageSlot` filename below — easiest swap).
 *   3. Update `description` with one true sentence about each job.
 *   4. Delete the `placeholder: true` flag once each entry is real.
 *
 * Spread across the 7 core services so the home page grid shows
 * breadth, not just driveways.
 */

export type Project = {
  /** Suggested image filename — matches what ImageSlot will display. */
  imageSlot: string;
  /** Short title (3–6 words). Renders as the card headline. */
  title: string;
  /** Service category — for the eyebrow. */
  serviceLabel: string;
  /** Neighborhood. Builds local trust. */
  neighborhood: string;
  /** One-line description. Keep tight. */
  description: string;
  /** PLACEHOLDER flag — replace each entry; component shows a dev badge. */
  placeholder?: boolean;
};

export const PROJECTS: readonly Project[] = [
  // PLACEHOLDER — REPLACE WITH REAL JOB
  {
    imageSlot: "project-01-driveway-clairemont.jpg",
    title: "Driveway tear-out and replace",
    serviceLabel: "Driveway Replacement",
    neighborhood: "Clairemont",
    description:
      "Cracked 1960s slab demoed and re-poured with a doweled apron tie-in. Two-day job.",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL JOB
  {
    imageSlot: "project-02-stamped-patio-la-mesa.jpg",
    title: "Stamped slate patio",
    serviceLabel: "Stamped Concrete Patio",
    neighborhood: "La Mesa",
    description:
      "650 sq ft of slate-pattern stamped patio with integral charcoal color and gloss seal.",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL JOB
  {
    imageSlot: "project-03-safe-sidewalks-north-park.jpg",
    title: "Safe Sidewalks Program repair",
    serviceLabel: "Safe Sidewalks",
    neighborhood: "North Park",
    description:
      "Three-panel city-spec sidewalk replacement with permit + inspection sign-off.",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL JOB
  {
    imageSlot: "project-04-pool-deck-point-loma.jpg",
    title: "Exposed-aggregate pool deck",
    serviceLabel: "Pool Deck",
    neighborhood: "Point Loma",
    description:
      "Slip-resistant pool deck with light tan aggregate. Drains away from the coping.",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL JOB
  {
    imageSlot: "project-05-rv-pad-el-cajon.jpg",
    title: "Reinforced RV pad",
    serviceLabel: "RV Pad",
    neighborhood: "El Cajon",
    description:
      "6-inch slab with doubled rebar — Class A motorhome lives here without a flicker.",
    placeholder: true,
  },
  // PLACEHOLDER — REPLACE WITH REAL JOB
  {
    imageSlot: "project-06-driveway-extension-bonita.jpg",
    title: "Driveway extension for second car",
    serviceLabel: "Driveway Extension",
    neighborhood: "Bonita",
    description:
      "Widened by 8 ft with doweled tie-in to the existing slab. Matches the original broom finish.",
    placeholder: true,
  },
];

export function pickProjects(count: number = 6): readonly Project[] {
  return PROJECTS.slice(0, count);
}
