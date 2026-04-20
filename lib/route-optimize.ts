/**
 * Route optimization — nearest-neighbor heuristic.
 *
 * Jobber's real route optimization uses the Google Maps Routes API, which
 * needs a billing-enabled API key. Until Ronnie wires `GOOGLE_MAPS_API_KEY`,
 * we do the next-best thing: a greedy nearest-neighbor pass over the
 * visits using a rough distance metric. If lat/lng aren't on the row
 * (most visits carry an address string, not geo coords) we:
 *
 *   1. Fall back to the input order (which is already time-sorted).
 *   2. When two visits share a city, cluster them together.
 *
 * The resulting ordered list is what `MapView` uses to build the
 * Google Maps multi-stop URL. The customer still sees the real route
 * Google suggests — we're just feeding it a sensible stop order.
 */

export type OptimizableStop = {
  id: string;
  address: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Time-anchor — if set, kept as a tiebreaker so AM visits don't
   *  jump after PM ones. ISO string. */
  scheduled_for?: string | null;
};

function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3959; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function cityFromAddress(addr: string | null): string {
  if (!addr) return "";
  // naive — last comma-separated part that isn't a ZIP / state.
  const parts = addr.split(",").map((s) => s.trim());
  for (const p of parts.reverse()) {
    if (!/^\d+$/.test(p) && !/^[A-Z]{2}$/i.test(p)) return p.toLowerCase();
  }
  return "";
}

/**
 * Order stops so the overall drive is short. Uses geo coords when
 * available; otherwise clusters by city name and preserves the
 * time-anchor order within each cluster.
 */
export function optimizeRoute<T extends OptimizableStop>(stops: T[]): T[] {
  if (stops.length <= 1) return stops;

  // Prefer coord-based nearest-neighbor when all stops have lat/lng.
  const withCoords = stops.filter(
    (s) => typeof s.lat === "number" && typeof s.lng === "number",
  );
  if (withCoords.length === stops.length) {
    const remaining = [...stops];
    const out: T[] = [];
    // Start from the earliest-scheduled (or first) stop.
    const first =
      remaining
        .slice()
        .sort((a, b) =>
          (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""),
        )[0] ?? remaining[0];
    out.push(first);
    remaining.splice(remaining.indexOf(first), 1);
    while (remaining.length > 0) {
      const last = out[out.length - 1];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(
          { lat: last.lat as number, lng: last.lng as number },
          {
            lat: remaining[i].lat as number,
            lng: remaining[i].lng as number,
          },
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      out.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }
    return out;
  }

  // No coords — cluster by city, preserving within-cluster time order.
  const clusters = new Map<string, T[]>();
  for (const s of stops) {
    const city = cityFromAddress(s.address);
    const arr = clusters.get(city) ?? [];
    arr.push(s);
    clusters.set(city, arr);
  }
  for (const arr of clusters.values()) {
    arr.sort((a, b) =>
      (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""),
    );
  }
  // Visit the biggest cluster first (usually where Ronnie is anchored
  // already), then clusters in rough descending size. Anything with
  // no city ends up at the tail.
  const named = Array.from(clusters.entries()).filter(([k]) => k);
  named.sort((a, b) => b[1].length - a[1].length);
  const unnamed = clusters.get("") ?? [];
  return [...named.flatMap(([, arr]) => arr), ...unnamed];
}
