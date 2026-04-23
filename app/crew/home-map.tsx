"use client";

/**
 * Crew home mini-map. Jobber shows an inline Google Map with pins
 * for every visit today. We don't have a Google Maps API key wired
 * yet, so this renders a clean "map-like" gradient card with a
 * count of today's stops + a "Route in Maps" CTA that opens the
 * multi-stop Google Maps URL (reuses the same route-optimize
 * ordering from the desktop schedule page).
 *
 * Once `GOOGLE_MAPS_API_KEY` is set (see lib/route-optimize comment),
 * we can swap the gradient for a Static Maps image and pin markers.
 */
import Link from "next/link";

type Pin = {
  id: string;
  lat?: number | null;
  lng?: number | null;
  address: string | null;
};

export function CrewHomeMap({
  pins,
  allAddresses,
}: {
  pins: Pin[];
  /** Full list of addresses in route order for the Google Maps URL. */
  allAddresses: string[];
}) {
  const stopCount = pins.length;
  const mapsHref = buildMultiStopUrl(allAddresses);

  return (
    <section className="relative overflow-hidden rounded-xl shadow-sm">
      {/* Faux map — layered gradient with grid lines for "map feel". */}
      <div
        aria-hidden="true"
        className="relative h-40 w-full"
        style={{
          background:
            "linear-gradient(135deg, #dbeadb 0%, #b5d6c0 40%, #8fbf9f 100%)",
        }}
      >
        {/* Subtle grid */}
        <svg
          className="absolute inset-0 h-full w-full opacity-30"
          viewBox="0 0 400 160"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4A7C59" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="160" fill="url(#map-grid)" />
        </svg>
        {/* Pins — distributed pseudo-randomly by index */}
        <div className="absolute inset-0">
          {pins.slice(0, 5).map((p, i) => {
            const left = 15 + (i * 73) % 80;
            const top = 20 + (i * 41) % 60;
            return (
              <div
                key={p.id}
                className="absolute flex items-center justify-center"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4A7C59] text-xs font-bold text-white shadow-lg ring-2 ring-white">
                  {i + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Link
        href={mapsHref}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 bg-white px-4 py-3 text-sm dark:bg-neutral-800"
      >
        <span className="font-semibold text-[#1a2332] dark:text-white">
          {stopCount} {stopCount === 1 ? "stop" : "stops"} today
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#4A7C59] px-3 py-1 text-xs font-bold text-white">
          Route in Maps →
        </span>
      </Link>
    </section>
  );
}

function buildMultiStopUrl(addresses: string[]): string {
  const valid = addresses.filter((a) => a && a.trim());
  if (valid.length === 0) return "https://www.google.com/maps";
  if (valid.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(valid[0])}&travelmode=driving`;
  }
  // For multi-stop, the destination is the last stop, and intermediate
  // stops go into `waypoints`. Google accepts up to 9 waypoints for free.
  const destination = valid[valid.length - 1];
  const waypoints = valid.slice(0, valid.length - 1).slice(0, 9);
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
