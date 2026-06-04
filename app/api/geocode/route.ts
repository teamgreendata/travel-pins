import { NextResponse } from "next/server";
import type { GeocodeResult } from "@/lib/types";

/**
 * Server-side proxy to OpenStreetMap Nominatim. Proxying (rather than calling
 * from the browser) lets us send the required User-Agent and keeps us within
 * Nominatim's usage policy (~1 req/s, no per-keystroke autocomplete — the client
 * debounces and searches on submit).
 *
 * Nominatim returns the full US state NAME ("Texas"), not the USPS code, so we
 * derive region_code from `address.ISO3166-2-lvl4` ("US-TX" -> "TX").
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] as GeocodeResult[] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "travel-pins/1.0 (Phase 1 build)",
        "Accept-Language": "en",
      },
      // Light caching is friendly to Nominatim for repeated identical queries.
      next: { revalidate: 60 },
    });
  } catch {
    return NextResponse.json(
      { results: [], error: "geocoder_unreachable" },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { results: [], error: "geocoder_error" },
      { status: 502 },
    );
  }

  const raw = (await res.json()) as Array<{
    name?: string;
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string | undefined>;
  }>;

  const results: GeocodeResult[] = raw
    .map((r) => {
      const addr = r.address ?? {};
      const country_code = (addr.country_code ?? "").toUpperCase() || null;

      let region_code: string | null = null;
      const iso = addr["ISO3166-2-lvl4"];
      if (country_code === "US" && typeof iso === "string" && iso.includes("-")) {
        region_code = iso.split("-")[1] ?? null;
      }

      const locality =
        addr.city ??
        addr.town ??
        addr.village ??
        addr.municipality ??
        addr.hamlet ??
        null;

      const label =
        r.name?.trim() ||
        locality ||
        r.display_name.split(",")[0]?.trim() ||
        r.display_name;

      return {
        label,
        display_name: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        country_code,
        region_code,
        locality,
      };
    })
    // country_code is NOT NULL in the schema, so drop results without one.
    .filter((r): r is GeocodeResult => Boolean(r.country_code));

  return NextResponse.json({ results });
}
