"use client";

/**
 * Google Places address autocomplete.
 *
 * Wires the Maps JavaScript API + Places library into a typeahead
 * input. As the user types, we fetch live suggestions from Google;
 * picking one fills the four address fields (street / city / state /
 * postal code) automatically.
 *
 * To enable in production:
 *   1. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to Vercel env vars.
 *   2. In Google Cloud Console, enable the **Maps JavaScript API**
 *      and the **Places API (New)** for the project.
 *   3. Restrict the key to your production + preview domains
 *      (HTTP referrer restriction) so it can't be abused.
 *
 * The component degrades cleanly when the key is missing — it still
 * works as a plain text input, just without autocomplete suggestions.
 *
 * Why the new `AutocompleteSessionToken` + `AutocompleteService` flow
 * (rather than the legacy `Autocomplete` widget)?
 *   - We render the suggestion dropdown ourselves so it matches the
 *     Jobber-style mobile aesthetic. The widget injects an unstyled
 *     gmaps `<div>` that's a pain to theme.
 *   - Session tokens (one per typing session, ending in a Place
 *     Details fetch) are what Google bills as a single autocomplete
 *     "session" — keeps cost predictable.
 */
import { useEffect, useId, useRef, useState } from "react";

// Lightweight, locally-typed shim for the Google Maps Places API. We
// only use a small slice — keeping the full @types/google.maps off the
// dependency list keeps the bundle leaner.
type GPrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
};
type GPlace = {
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  formatted_address?: string;
  geometry?: { location: { lat(): number; lng(): number } };
};
type GAutocompleteService = {
  getPlacePredictions(
    req: {
      input: string;
      sessionToken?: unknown;
      componentRestrictions?: { country: string | string[] };
      types?: string[];
    },
    cb: (preds: GPrediction[] | null, status: string) => void,
  ): void;
};
type GPlacesService = {
  getDetails(
    req: { placeId: string; fields: string[]; sessionToken?: unknown },
    cb: (place: GPlace | null, status: string) => void,
  ): void;
};
type GMapsPlacesNamespace = {
  AutocompleteService: new () => GAutocompleteService;
  AutocompleteSessionToken: new () => unknown;
  PlacesService: new (attr: HTMLElement) => GPlacesService;
};

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: GMapsPlacesNamespace;
      };
    };
  }
}

const SCRIPT_ID = "rc-google-maps-script";

/** Loads the Maps JS API + Places library exactly once across the
 *  whole tab. Returns a promise that resolves when window.google.maps
 *  is ready, or rejects if the API key isn't set. */
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (window.google?.maps?.places) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=places&v=weekly`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });
}

export type AddressParts = {
  /** Street number + route, e.g. "1234 Oak St". */
  street: string;
  city: string;
  state: string;
  postalCode: string;
  /** Full one-line address from Google. */
  formatted: string;
  lat?: number;
  lng?: number;
};

function partsFromComponents(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
): { street: string; city: string; state: string; postalCode: string } {
  let streetNumber = "";
  let route = "";
  let city = "";
  let state = "";
  let postalCode = "";
  for (const c of components) {
    if (c.types.includes("street_number")) streetNumber = c.long_name;
    else if (c.types.includes("route")) route = c.long_name;
    else if (c.types.includes("locality")) city = c.long_name;
    else if (c.types.includes("postal_town") && !city) city = c.long_name;
    else if (c.types.includes("sublocality") && !city) city = c.long_name;
    else if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    else if (c.types.includes("postal_code")) postalCode = c.long_name;
  }
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();
  return { street, city, state, postalCode };
}

export function AddressAutocomplete({
  /** Form input names for each parsed component. */
  streetName = "address",
  cityName = "city",
  stateName = "state",
  postalCodeName = "postal_code",
  defaultStreet = "",
  defaultCity = "",
  defaultState = "",
  defaultPostalCode = "",
  placeholder = "Property address",
  /** Restrict suggestions to one or more ISO country codes. Default US. */
  countries = ["us"],
  className,
}: {
  streetName?: string;
  cityName?: string;
  stateName?: string;
  postalCodeName?: string;
  defaultStreet?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultPostalCode?: string;
  placeholder?: string;
  countries?: string[];
  className?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const inputId = useId();
  const [street, setStreet] = useState(defaultStreet);
  const [city, setCity] = useState(defaultCity);
  const [stateAbbr, setStateAbbr] = useState(defaultState);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [predictions, setPredictions] = useState<
    Array<{
      placeId: string;
      mainText: string;
      secondaryText: string;
      description: string;
    }>
  >([]);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const acService = useRef<GAutocompleteService | null>(null);
  const placesService = useRef<GPlacesService | null>(null);
  const sessionToken = useRef<unknown>(null);
  // Hidden div Places library needs as an "attribution element".
  const placesAttrRef = useRef<HTMLDivElement | null>(null);

  // Lazy-load the Maps JS once the user focuses the field — saves
  // bandwidth + Google bill for users who never use this form.
  const [loaded, setLoaded] = useState(false);
  function ensureLoaded() {
    if (loaded || !apiKey) return;
    loadGoogleMaps(apiKey)
      .then(() => {
        const places = window.google?.maps?.places;
        if (!places) throw new Error("places library missing");
        acService.current = new places.AutocompleteService();
        if (placesAttrRef.current) {
          placesService.current = new places.PlacesService(placesAttrRef.current);
        }
        sessionToken.current = new places.AutocompleteSessionToken();
        setLoaded(true);
      })
      .catch((err: Error) => {
        setLoadError(err.message);
      });
  }

  // Debounced predictions fetch.
  useEffect(() => {
    if (!loaded || !acService.current) return;
    const q = street.trim();
    if (q.length < 3) {
      setPredictions([]);
      return;
    }
    const handle = setTimeout(() => {
      acService.current?.getPlacePredictions(
        {
          input: q,
          sessionToken: sessionToken.current ?? undefined,
          componentRestrictions: { country: countries },
          types: ["address"],
        },
        (preds, status) => {
          if (status !== "OK" || !preds) {
            setPredictions([]);
            return;
          }
          setPredictions(
            preds.slice(0, 5).map((p) => ({
              placeId: p.place_id,
              mainText: p.structured_formatting?.main_text ?? p.description,
              secondaryText: p.structured_formatting?.secondary_text ?? "",
              description: p.description,
            })),
          );
        },
      );
    }, 200);
    return () => clearTimeout(handle);
  }, [street, loaded, countries]);

  function pick(placeId: string) {
    if (!placesService.current) return;
    placesService.current.getDetails(
      {
        placeId,
        sessionToken: sessionToken.current ?? undefined,
        fields: ["address_components", "formatted_address", "geometry"],
      },
      (place, status) => {
        if (status !== "OK" || !place || !place.address_components) return;
        const parts = partsFromComponents(place.address_components);
        setStreet(parts.street);
        setCity(parts.city);
        setStateAbbr(parts.state);
        setPostalCode(parts.postalCode);
        setPredictions([]);
        setOpen(false);
        // Start a new session for the next typing flow.
        const places = window.google?.maps?.places;
        if (places) sessionToken.current = new places.AutocompleteSessionToken();
      },
    );
  }

  return (
    <div className={className ?? "space-y-2"}>
      {/* Hidden div Google's Places library uses for attribution. */}
      <div ref={placesAttrRef} hidden />

      {/* Street + autocomplete dropdown */}
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Street address
        </label>
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-800">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-neutral-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z" />
            <circle cx="12" cy="9" r="3" />
          </svg>
          <input
            id={inputId}
            type="text"
            name={streetName}
            value={street}
            onChange={(e) => {
              setStreet(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              ensureLoaded();
              setOpen(true);
            }}
            onBlur={() => {
              // Delay so a click on a prediction can register first.
              setTimeout(() => setOpen(false), 200);
            }}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-[#1a2332] placeholder:text-neutral-400 focus:outline-none dark:text-white"
          />
        </div>
        {open && predictions.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p.placeId)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700"
                >
                  <span className="block font-semibold text-[#1a2332] dark:text-white">
                    {p.mainText}
                  </span>
                  {p.secondaryText && (
                    <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {p.secondaryText}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {loadError && (
          <p className="mt-1 text-[11px] text-red-600">
            Address autocomplete unavailable: {loadError}
          </p>
        )}
        {!apiKey && (
          <p className="mt-1 text-[11px] text-neutral-500">
            Address autocomplete will activate once Ronnie sets{" "}
            <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
          </p>
        )}
      </div>

      {/* City / State / Zip — three-column row */}
      <div className="grid grid-cols-3 gap-2">
        <input
          name={cityName}
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="col-span-3 rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white sm:col-span-1"
        />
        <input
          name={stateName}
          type="text"
          value={stateAbbr}
          onChange={(e) => setStateAbbr(e.target.value.toUpperCase())}
          placeholder="State"
          maxLength={2}
          className="col-span-1 rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm uppercase tracking-wide text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
        <input
          name={postalCodeName}
          type="text"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="Zip"
          inputMode="numeric"
          className="col-span-2 rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-[#1a2332] placeholder:text-neutral-400 focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
      </div>
    </div>
  );
}
