import { COUNTRY_CONTINENT } from "./continents";
import type { Category, Place } from "./types";

// % of world denominator: UN members + observer states (handoff spec §9).
const WORLD_COUNTRIES = 195;

export interface TravelStats {
  countriesVisited: number; // distinct countries actually visited (excl. want_to_visit)
  usStates: number; // distinct US states visited (by USPS region_code)
  totalPlaces: number;
  lived: number;
  wishlist: number;
  percentOfWorld: number; // 0..100, one decimal
  continents: string[];
  byCategory: Record<Category, number>;
}

/**
 * Passport stats derived from a user's pins. "Visited" excludes want_to_visit
 * (a wish is not a visit) — consistent with the choropleth fill rule. This is a
 * deliberate reading of spec §9's user_stats, whose raw `count(distinct
 * country_code)` would also count wishlist-only countries.
 */
export function computeStats(places: Place[]): TravelStats {
  const visitedCountries = new Set<string>();
  const usStates = new Set<string>();
  const continents = new Set<string>();
  const byCategory: Record<Category, number> = {
    lived: 0,
    visited: 0,
    want_to_visit: 0,
    passed_through: 0,
  };
  let lived = 0;
  let wishlist = 0;

  for (const p of places) {
    byCategory[p.category]++;
    if (p.category === "lived") lived++;
    if (p.category === "want_to_visit") {
      wishlist++;
      continue; // wishes don't count toward visited countries/states/continents
    }
    const cc = p.country_code?.trim().toUpperCase();
    if (cc) {
      visitedCountries.add(cc);
      const cont = COUNTRY_CONTINENT[cc];
      if (cont) continents.add(cont);
      if (cc === "US" && p.region_code) {
        usStates.add(p.region_code.trim().toUpperCase());
      }
    }
  }

  return {
    countriesVisited: visitedCountries.size,
    usStates: usStates.size,
    totalPlaces: places.length,
    lived,
    wishlist,
    percentOfWorld:
      Math.round((visitedCountries.size / WORLD_COUNTRIES) * 1000) / 10,
    continents: [...continents].sort(),
    byCategory,
  };
}

/** Distinct years present in places' visited_on, most recent first. */
export function placeYears(places: Place[]): number[] {
  const years = new Set<number>();
  for (const p of places) {
    if (p.visited_on) {
      const y = Number(p.visited_on.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
  }
  return [...years].sort((a, b) => b - a);
}

/** Filter to pins with visited_on in `year`, or all pins when year is null. */
export function filterByYear(places: Place[], year: number | null): Place[] {
  if (year == null) return places;
  return places.filter(
    (p) => p.visited_on && Number(p.visited_on.slice(0, 4)) === year,
  );
}
