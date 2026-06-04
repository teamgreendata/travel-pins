// Author-time build: slim Natural Earth 50m admin-1 into US states only,
// carrying just geometry + the USPS 2-letter code (`stusps`, from NE's `postal`).
//
// NOTE (deviation from spec §8, flagged): the spec names the Census cb_2022
// shapefile (STUSPS). That requires GDAL to convert; Natural Earth's admin-1
// `postal` field IS the USPS 2-letter code and ships as GeoJSON, so we use it —
// same match key (USPS, not FIPS), consistent with the M3 country source. Run:
//   curl -sL -o public/geo/_raw_states.geojson <ne_50m_admin_1 url>
//   node scripts/build-us-states.mjs
import { readFileSync, writeFileSync, statSync } from "node:fs";

const SRC = "public/geo/_raw_states.geojson";
const OUT = "public/geo/us-states.geojson";

const gj = JSON.parse(readFileSync(SRC, "utf8"));

const features = gj.features
  .filter(
    (f) =>
      f.properties.iso_a2 === "US" ||
      f.properties.admin === "United States of America",
  )
  .map((f) => {
    const postal = String(f.properties.postal || "").trim().toUpperCase();
    return {
      type: "Feature",
      properties: {
        stusps: /^[A-Z]{2}$/.test(postal) ? postal : null,
        name: f.properties.name || null,
      },
      geometry: f.geometry,
    };
  })
  .filter((f) => f.properties.stusps);

writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features }));

const codes = features.map((f) => f.properties.stusps).sort();
console.log("US state features:", features.length);
console.log(
  "CA:", codes.includes("CA"),
  "| TX:", codes.includes("TX"),
  "| DC:", codes.includes("DC"),
  "| AK:", codes.includes("AK"),
  "| HI:", codes.includes("HI"),
);
console.log("codes:", codes.join(","));
console.log("output size KB:", Math.round(statSync(OUT).size / 1024));
