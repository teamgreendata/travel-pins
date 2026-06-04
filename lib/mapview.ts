import { CATEGORY_META } from "./categories";
import type { Category, Place } from "./types";

/** Configures a map route (world vs US) for the shared MapClient component. */
export interface MapViewConfig {
  id: "world" | "us";
  center: [number, number];
  zoom: number;
  boundaryUrl: string;
  boundaryPromoteId: string;
  /** Boundary key for a place (country iso_a2 / state stusps), or null to skip. */
  fillKey: (p: Place) => string | null;
}

export const WORLD_VIEW: MapViewConfig = {
  id: "world",
  center: [10, 30],
  zoom: 1.6,
  boundaryUrl: "/geo/countries-110m.geojson",
  boundaryPromoteId: "iso_a2",
  fillKey: (p) => p.country_code?.trim().toUpperCase() || null,
};

export const US_VIEW: MapViewConfig = {
  id: "us",
  center: [-98, 39],
  zoom: 3.2,
  boundaryUrl: "/geo/us-states.geojson",
  boundaryPromoteId: "stusps",
  // Match on the USPS 2-letter region_code (STUSPS), only for US places.
  fillKey: (p) =>
    p.country_code === "US" && p.region_code
      ? p.region_code.trim().toUpperCase()
      : null,
};

export type ViewId = MapViewConfig["id"];

/** Look up a view config by id (client-side; keeps the fillKey function off the
 *  Server->Client props boundary, where functions aren't serializable). */
export function getView(id: ViewId): MapViewConfig {
  return id === "us" ? US_VIEW : WORLD_VIEW;
}

// Choropleth fill precedence: lived > visited > passed_through.
// want_to_visit NEVER fills (a wish is not a visit) — it only shows as a pin.
const FILL_RANK: Record<string, number> = { lived: 3, visited: 2, passed_through: 1 };
const RANK_CATEGORY: Record<number, Category> = {
  3: "lived",
  2: "visited",
  1: "passed_through",
};

/** boundaryKey -> fill color, by each region's strongest visible visit category. */
export function computeFills(
  places: Place[],
  hidden: Set<Category>,
  keyFn: (p: Place) => string | null,
): Map<string, string> {
  const best = new Map<string, number>();
  for (const p of places) {
    if (p.category === "want_to_visit" || hidden.has(p.category)) continue;
    const rank = FILL_RANK[p.category];
    if (!rank) continue;
    const key = keyFn(p);
    if (!key) continue;
    if (!best.has(key) || rank > best.get(key)!) best.set(key, rank);
  }
  const fills = new Map<string, string>();
  for (const [key, rank] of best) {
    fills.set(key, CATEGORY_META[RANK_CATEGORY[rank]].color);
  }
  return fills;
}
