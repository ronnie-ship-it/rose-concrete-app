import { ImageSlot } from "@/components/marketing/image-slot";
import { pickProjects } from "@/lib/marketing/projects";
import {
  getRecentProjectsForGallery,
  getRecentProjectsForService,
} from "@/lib/marketing/project-photos";
import { serviceLabel } from "@/lib/service-types";
import { cn } from "@/lib/utils";

/**
 * <RecentProjects /> — recent jobs grid.
 *
 * Two query modes:
 *
 *   (default, no `serviceTypes` prop) — calls `getRecentProjectsForGallery`,
 *   which returns the most-recent N across ALL service types. Used by
 *   the home page where the gallery is intentionally cross-service.
 *
 *   (with `serviceTypes`) — calls `getRecentProjectsForService(serviceTypes)`,
 *   filtered to the page's service. Used by every `/services/<slug>`
 *   page so each gallery shows only its own work. Accepts a single
 *   string or an array (combined service pages like
 *   `walkways-sidewalks` pass `['walkway', 'sidewalk', 'safe_sidewalks_program']`).
 *
 * Falls back to gradient `<ImageSlot>` placeholders from
 * `lib/marketing/projects.ts` when the underlying query returns
 * zero rows — so a fresh install (or a service with no Final
 * photos yet) still shows a visually-finished section.
 *
 * Server component — fetches at request time.
 */

export async function RecentProjects({
  heading = "Recent work in San Diego County",
  sub = "Six recent jobs across the county. Photos straight from the project record.",
  count = 6,
  serviceTypes,
  className,
}: {
  heading?: string;
  sub?: string;
  count?: number;
  /** When provided, the gallery filters to only these service types.
   *  Omitting the prop keeps the all-services homepage behavior. */
  serviceTypes?: string | readonly string[];
  className?: string;
}) {
  const real = serviceTypes
    ? await getRecentProjectsForService(serviceTypes, { limit: count })
    : await getRecentProjectsForGallery(count);
  const usingPlaceholders = real.length === 0;

  return (
    <div className={cn(className)}>
      <header className="mb-6 max-w-3xl sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          Recent work · 2025–2026
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-brand-900 sm:text-3xl">
          {heading}
        </h2>
        {sub && <p className="mt-2 text-base text-brand-700/80">{sub}</p>}
      </header>

      {usingPlaceholders ? (
        <PlaceholderGrid count={count} />
      ) : (
        <RealGrid photos={real} />
      )}
    </div>
  );
}

function RealGrid({
  photos,
}: {
  photos: Awaited<ReturnType<typeof getRecentProjectsForGallery>>;
}) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((p) => {
        const ago = relativeAge(p.created_at);
        const service = serviceLabel(p.service_type);
        return (
          <li
            key={p.id}
            className="flex flex-col rounded-xl border border-brand-100 bg-white p-3 shadow-sm"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100">
              {/* Native <img> on purpose: marketing pages are static-rendered,
                  and using next/image with cross-origin Supabase URLs needs
                  remotePatterns config + adds work for an LCP that's already
                  good. Fixed aspect-ratio prevents layout shift. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.public_url}
                alt={p.alt_text ?? `${service} project in ${p.client_city ?? "San Diego County"}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="px-2 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
                {p.client_city ?? "San Diego County"}
              </p>
              <p className="mt-1 text-base font-bold text-brand-900">
                {service !== "—" ? service : (p.project_name ?? "Concrete project")}
              </p>
              <p className="mt-1 text-sm text-brand-700/80">{ago}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PlaceholderGrid({ count }: { count: number }) {
  const projects = pickProjects(count);
  return (
    <>
      <p className="mb-4 inline-block rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-900">
        Photos coming — gradient placeholders until Ronnie uploads project
        photos via the dashboard. The marketing site will swap automatically.
      </p>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li
            key={p.imageSlot}
            className="flex flex-col rounded-xl border border-brand-100 bg-white p-3 shadow-sm"
          >
            <ImageSlot
              slot={p.imageSlot}
              eyebrow={p.serviceLabel}
              headline={p.title}
              aspect="hero"
            />
            <div className="px-2 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
                {p.neighborhood}
              </p>
              <p className="mt-1 text-base font-bold text-brand-900">{p.title}</p>
              <p className="mt-1 text-sm text-brand-700/90">{p.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** "2 weeks ago" / "3 days ago" — short, marketing-friendly. */
function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "Last month";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
