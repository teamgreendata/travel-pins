// Author-time build: slim Natural Earth 110m countries into a small GeoJSON
// carrying just geometry + a clean ISO 3166-1 alpha-2 code (`iso_a2`).
//
// Source: ne_110m_admin_0_countries.geojson (Natural Earth, public domain).
// The raw ISO_A2 has "-99" for France/Norway/others; ISO_A2_EH fixes those, so
// we prefer ISO_A2_EH and fall back to ISO_A2. Run:
//   curl -sL -o public/geo/_raw.geojson <ne_110m url>
//   node scripts/build-countries.mjs
import { readFileSync, writeFileSync, statSync } from "node:fs";

const SRC = "public/geo/_raw.geojson";
const OUT = "public/geo/countries-110m.geojson";

const gj = JSON.parse(readFileSync(SRC, "utf8"));

function cleanIso(p) {
  for (const k of ["ISO_A2_EH", "ISO_A2"]) {
    const v = p[k];
    if (v && v !== "-99" && /^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  }
  return null;
}

const features = gj.features.map((f) => ({
  type: "Feature",
  properties: {
    iso_a2: cleanIso(f.properties),
    name: f.properties.NAME || f.properties.ADMIN || null,
  },
  geometry: f.geometry,
}));

writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features }));

const missing = features.filter((f) => !f.properties.iso_a2);
const has = (code) => features.some((f) => f.properties.iso_a2 === code);
console.log("total features:", features.length);
console.log("with iso_a2:", features.length - missing.length, "| missing:", missing.length);
console.log("France=FR:", has("FR"), "| Norway=NO:", has("NO"), "| USA=US:", has("US"));
console.log("missing (won't fill):", missing.map((f) => f.properties.name).join(", "));
console.log("output size KB:", Math.round(statSync(OUT).size / 1024));
