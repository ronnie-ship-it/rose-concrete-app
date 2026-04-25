"use client";

/**
 * Jobber-mobile mini-map for the crew home screen.
 *
 * Without a Google Maps API key wired up we render a stylized "map"
 * SVG with road lines + neighborhood labels + a blue "you are here"
 * dot, matching the Apr 2026 screenshot. Pins float on top for each
 * scheduled visit (numbered green circles).
 *
 * The card is tappable as a whole — opens the multi-stop Google Maps
 * URL with all of today's addresses ordered for a route. A "View all >"
 * link sits in the bottom-right corner of the map (also tappable).
 *
 * Once `GOOGLE_MAPS_API_KEY` is set we can swap the SVG background for
 * a Static Maps image without any other changes.
 */
import Link from "next/link";

type Pin = {
  id: string;
  lat?: number | null;
  lng?: number | null;
  address: string | null;
};

const NEIGHBORHOODS = [
  { x: 25, y: 28, label: "GRANT HILL" },
  { x: 70, y: 32, label: "MT HOPE" },
  { x: 18, y: 60, label: "LOGAN HEIGHTS" },
  { x: 50, y: 55, label: "MOUNTAIN VIEW" },
  { x: 22, y: 80, label: "BARRIO LOGAN" },
  { x: 70, y: 78, label: "SOUTHCREST" },
];

export function CrewHomeMap({
  pins,
  allAddresses,
}: {
  pins: Pin[];
  /** Full list of addresses in route order for the Google Maps URL. */
  allAddresses: string[];
}) {
  const mapsHref = buildMultiStopUrl(allAddresses);

  return (
    <Link
      href={mapsHref}
      target="_blank"
      rel="noreferrer"
      className="relative block overflow-hidden rounded-2xl shadow-sm"
    >
      {/* Map area */}
      <div
        aria-hidden="true"
        className="relative h-52 w-full"
        style={{
          background:
            "linear-gradient(180deg, #e8edf2 0%, #dde6ed 50%, #d4dfe6 100%)",
        }}
      >
        {/* Road network — soft gray lines */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
        >
          {/* Major roads */}
          <path
            d="M 0 80 Q 100 70 200 90 T 400 100"
            stroke="#FFF"
            strokeWidth="6"
            fill="none"
          />
          <path
            d="M 0 80 Q 100 70 200 90 T 400 100"
            stroke="#C9D2DA"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M 60 0 Q 80 80 100 200"
            stroke="#FFF"
            strokeWidth="5"
            fill="none"
          />
          <path
            d="M 60 0 Q 80 80 100 200"
            stroke="#C9D2DA"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M 280 0 Q 300 100 290 200"
            stroke="#FFF"
            strokeWidth="5"
            fill="none"
          />
          <path
            d="M 280 0 Q 300 100 290 200"
            stroke="#C9D2DA"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Minor street grid */}
          <g stroke="#FFF" strokeWidth="2" fill="none" opacity="0.7">
            <path d="M 0 40 L 400 50" />
            <path d="M 0 130 L 400 145" />
            <path d="M 0 170 L 400 175" />
            <path d="M 150 0 L 145 200" />
            <path d="M 220 0 L 215 200" />
            <path d="M 360 0 L 355 200" />
          </g>
          {/* Water tint on left edge — San Diego Bay vibe */}
          <rect x="0" y="120" width="50" height="80" fill="#bcd5e6" opacity="0.6" />
        </svg>

        {/* Neighborhood labels */}
        <div className="absolute inset-0">
          {NEIGHBORHOODS.map((n) => (
            <span
              key={n.label}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-wider text-neutral-500"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {n.label}
            </span>
          ))}
        </div>

        {/* You-are-here blue dot — center of the map */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        >
          <span className="absolute h-5 w-5 animate-ping rounded-full bg-[#3B82F6] opacity-30" />
          <span className="relative h-3 w-3 rounded-full border-2 border-white bg-[#3B82F6] shadow" />
        </span>

        {/* Visit pins — distributed pseudo-randomly by index */}
        <div className="absolute inset-0">
          {pins.slice(0, 8).map((p, i) => {
            const left = 18 + (i * 73) % 70;
            const top = 22 + (i * 41) % 55;
            return (
              <span
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A7B40] text-[10px] font-bold text-white shadow-md ring-2 ring-white">
                  {i + 1}
                </span>
              </span>
            );
          })}
        </div>

        {/* "View all >" floating label in bottom-right */}
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-0.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#1a2332] shadow-sm">
          View all
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function buildMultiStopUrl(addresses: string[]): string {
  const valid = addresses.filter((a) => a && a.trim());
  if (valid.length === 0) return "https://www.google.com/maps";
  if (valid.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      valid[0],
    )}&travelmode=driving`;
  }
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
