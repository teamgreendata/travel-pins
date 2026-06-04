// Validates the choropleth fill algorithm (mirrors computeFills in lib/mapview.ts):
// each region fills by its STRONGEST VISIBLE visit category; want_to_visit is
// excluded; precedence lived > visited > passed_through. Covers both the world
// (country_code) and US (state via region_code) key functions.
// Run: node scripts/test-fills.mjs
const COLOR = {
  lived: "#D55E00",
  visited: "#0072B2",
  want_to_visit: "#009E73",
  passed_through: "#CC79A7",
};
const RANK = { lived: 3, visited: 2, passed_through: 1 };
const RANK_CAT = { 3: "lived", 2: "visited", 1: "passed_through" };

function computeFills(places, hidden, keyFn) {
  const best = new Map();
  for (const p of places) {
    if (p.category === "want_to_visit" || hidden.has(p.category)) continue;
    const rank = RANK[p.category];
    if (!rank) continue;
    const key = keyFn(p);
    if (!key) continue;
    if (!best.has(key) || rank > best.get(key)) best.set(key, rank);
  }
  const fills = new Map();
  for (const [k, rank] of best) fills.set(k, COLOR[RANK_CAT[rank]]);
  return fills;
}

const worldKey = (p) => (p.country_code || "").trim().toUpperCase() || null;
const usKey = (p) =>
  p.country_code === "US" && p.region_code
    ? p.region_code.trim().toUpperCase()
    : null;

let pass = 0,
  fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(a)} want=${JSON.stringify(b)}`}`);
  if (ok) pass++;
  else fail++;
};
const P = (country_code, category, region_code = null) => ({ country_code, category, region_code });
const F = (places, keyFn, hidden) => [...computeFills(places, hidden || new Set(), keyFn)];

// World (country) fills
eq("world: France visited -> FR blue", F([P("FR", "visited")], worldKey), [["FR", "#0072B2"]]);
eq("world: want_to_visit JP does NOT fill", F([P("JP", "want_to_visit")], worldKey), []);
eq("world: lived beats visited (US)", F([P("US", "visited"), P("US", "lived")], worldKey), [["US", "#D55E00"]]);
eq("world: hiding 'lived' drops fill (DE)", F([P("DE", "lived")], worldKey, new Set(["lived"])), []);
eq("world: lowercase country normalized (fr)", F([P("fr", "visited")], worldKey), [["FR", "#0072B2"]]);

// US (state) fills, keyed on the USPS region_code
eq("us: TX visited -> TX blue", F([P("US", "visited", "TX")], usKey), [["TX", "#0072B2"]]);
eq("us: non-US place fills NO state", F([P("FR", "visited")], usKey), []);
eq("us: want_to_visit TX does NOT fill", F([P("US", "want_to_visit", "TX")], usKey), []);
eq("us: lived beats passed_through (CA)", F([P("US", "passed_through", "CA"), P("US", "lived", "CA")], usKey), [["CA", "#D55E00"]]);
eq("us: US place without region_code does not fill", F([P("US", "visited", null)], usKey), []);
eq("us: lowercase region normalized (ny)", F([P("US", "visited", "ny")], usKey), [["NY", "#0072B2"]]);

console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
