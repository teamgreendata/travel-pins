export type Category = "lived" | "visited" | "want_to_visit" | "passed_through";
export type Visibility = "private" | "friends" | "public";

/**
 * A single geocoded pin — the app's single source of truth. Country/US-state
 * fills are derived from these rows, never stored separately.
 *
 * NOTE: this is a hand-written shape for Phase 1; it will be replaced by
 * Supabase-generated types (for the `travel_pins` schema) once the project is
 * connected.
 */
export interface Place {
  id: string;
  user_id: string;
  label: string;
  category: Category;
  lat: number;
  lng: number;
  country_code: string;
  region_code: string | null;
  locality: string | null;
  visited_on: string | null;
  notes: string | null;
  is_home: boolean;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the /api/geocode route (Nominatim, normalized). */
export interface GeocodeResult {
  label: string;
  display_name: string;
  lat: number;
  lng: number;
  country_code: string;
  region_code: string | null;
  locality: string | null;
}
