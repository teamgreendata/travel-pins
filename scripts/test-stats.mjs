// Validates passport stats + year filtering (mirrors lib/stats.ts). want_to_visit
// is excluded from visited countries/states/continents; % of world = visited/195.
// Run: node scripts/test-stats.mjs
const CONT = { FR: "Europe", US: "North America", JP: "Asia", BR: "South America" };
const WORLD = 195;

function computeStats(places) {
  const vc = new Set(), us = new Set(), cont = new Set();
  const byCategory = { lived: 0, visited: 0, want_to_visit: 0, passed_through: 0 };
  let lived = 0, wishlist = 0;
  for (const p of places) {
    byCategory[p.category]++;
    if (p.category === "lived") lived++;
    if (p.category === "want_to_visit") { wishlist++; continue; }
    const cc = (p.country_code || "").trim().toUpperCase();
    if (cc) {
      vc.add(cc);
      if (CONT[cc]) cont.add(CONT[cc]);
      if (cc === "US" && p.region_code) us.add(p.region_code.trim().toUpperCase());
    }
  }
  return {
    countriesVisited: vc.size, usStates: us.size, totalPlaces: places.length,
    lived, wishlist, percentOfWorld: Math.round((vc.size / WORLD) * 1000) / 10,
    continents: [...cont].sort(), byCategory,
  };
}
const placeYears = (places) => {
  const y = new Set();
  for (const p of places) if (p.visited_on) { const n = Number(p.visited_on.slice(0, 4)); if (!Number.isNaN(n)) y.add(n); }
  return [...y].sort((a, b) => b - a);
};
const filterByYear = (places, year) =>
  year == null ? places : places.filter((p) => p.visited_on && Number(p.visited_on.slice(0, 4)) === year);

let pass = 0, fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(a)} want=${JSON.stringify(b)}`}`);
  if (ok) pass++; else fail++;
};
const P = (country_code, category, region_code = null, visited_on = null) => ({ country_code, category, region_code, visited_on });

const places = [
  P("FR", "visited", null, "2019-07-01"),
  P("FR", "lived", null, "2020-01-01"),
  P("US", "visited", "TX", "2019-05-01"),
  P("US", "passed_through", "CA", "2021-03-01"),
  P("JP", "want_to_visit", null, "2022-01-01"),
  P("BR", "visited", null, null),
];
const s = computeStats(places);
eq("countriesVisited (FR,US,BR; JP wishlist excluded)", s.countriesVisited, 3);
eq("usStates (TX,CA)", s.usStates, 2);
eq("totalPlaces (incl wishlist)", s.totalPlaces, 6);
eq("lived", s.lived, 1);
eq("wishlist", s.wishlist, 1);
eq("continents", s.continents, ["Europe", "North America", "South America"]);
eq("percentOfWorld 3/195", s.percentOfWorld, Math.round((3 / 195) * 1000) / 10);
eq("byCategory", s.byCategory, { lived: 1, visited: 3, want_to_visit: 1, passed_through: 1 });

eq("placeYears desc", placeYears(places), [2022, 2021, 2020, 2019]);
eq("filterByYear 2019 -> 2 pins", filterByYear(places, 2019).length, 2);
eq("2019 countriesVisited (FR,US)", computeStats(filterByYear(places, 2019)).countriesVisited, 2);
eq("filterByYear null -> all", filterByYear(places, null).length, 6);

console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
