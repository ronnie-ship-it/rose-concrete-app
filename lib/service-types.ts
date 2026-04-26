/**
 * Single source of truth for the `service_type` enum.
 *
 * Every new enum value needs both an ALTER TYPE in a migration AND an
 * entry here; the UI validators + booking form + webhook validator all
 * pull from this list so they can&apos;t drift.
 */

export const SERVICE_TYPES = [
  "driveway",
  "stamped_driveway",
  "patio",
  "sidewalk",
  "walkway",
  "rv_pad",
  "pickleball_court",
  "retaining_wall",
  "pool_deck",
  "foundation",
  "curb_and_gutter",
  "slab",
  "resurface",
  "demo",
  "steps",
  "footings",
  "fence_post_footings",
  "repair",
  // Marketing-site additions (migration 028) — public service categories
  // that don't always map to a back-office workflow but need their own
  // landing pages and lead routing.
  "exposed_aggregate",
  "paving",
  "drainage",
  "driveway_extension",
  "driveway_apron",
  "commercial_flatwork",
  "safe_sidewalks_program",
  // Migration 029 — Decorative Concrete service-page bucket.
  "decorative_concrete",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export function isServiceType(v: unknown): v is ServiceType {
  return typeof v === "string" && (SERVICE_TYPES as readonly string[]).includes(v);
}

export const SERVICE_LABEL: Record<ServiceType, string> = {
  driveway: "Driveway",
  stamped_driveway: "Stamped driveway",
  patio: "Patio",
  sidewalk: "Sidewalk",
  walkway: "Walkway",
  rv_pad: "RV pad",
  pickleball_court: "Pickleball court",
  retaining_wall: "Retaining wall",
  pool_deck: "Pool deck",
  foundation: "Foundation",
  curb_and_gutter: "Curb & gutter",
  slab: "Slab",
  resurface: "Resurface / overlay",
  demo: "Demo / removal",
  steps: "Steps",
  footings: "Footings",
  fence_post_footings: "Fence-post footings",
  repair: "Repair / crack fix",
  exposed_aggregate: "Exposed aggregate",
  paving: "Paving",
  drainage: "Drainage / french drain",
  driveway_extension: "Driveway extension",
  driveway_apron: "Driveway apron",
  commercial_flatwork: "Commercial flatwork",
  safe_sidewalks_program: "Safe Sidewalks Program",
  decorative_concrete: "Decorative concrete",
  other: "Something else",
};

/** Human label for a service_type string, with safe fallback. */
export function serviceLabel(v: string | null | undefined): string {
  if (!v) return "—";
  if (isServiceType(v)) return SERVICE_LABEL[v];
  return v.replace(/_/g, " ");
}

/**
 * Service-types deliberately HIDDEN from the public marketing form
 * dropdown. These remain valid `ServiceType` values for historical
 * leads + internal dashboards, but a homeowner can't pick them on the
 * lead form anymore.
 *
 * - `foundation` — Rose Concrete is no longer doing foundation work
 *   going forward (decided 2026-04-25). Out of scope. The DB enum
 *   value stays so historical lead rows continue to type-check; only
 *   the marketing form hides it.
 *
 * Used by `MARKETING_FORM_SERVICE_TYPES` below — that's what the
 * <LeadForm /> dropdown iterates.
 */
export const EXCLUDED_FROM_MARKETING_FORM = new Set<ServiceType>([
  "foundation",
]);

/**
 * The service-type list that drives the public marketing form dropdown.
 * Same as `SERVICE_TYPES` minus anything in `EXCLUDED_FROM_MARKETING_FORM`.
 *
 * Internal dashboards / forms keep using `SERVICE_TYPES` directly so
 * they can still display + filter historical foundation leads.
 */
export const MARKETING_FORM_SERVICE_TYPES: readonly ServiceType[] =
  SERVICE_TYPES.filter((s) => !EXCLUDED_FROM_MARKETING_FORM.has(s));
