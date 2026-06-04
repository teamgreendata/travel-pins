// M1 acceptance: proves the auth + profile + place + RLS round-trip end-to-end
// against the live green-phoenix project, through GoTrue + PostgREST (travel_pins
// schema) — exactly the path the app uses. Run: node scripts/m1-acceptance.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const rnd = () => Math.random().toString(36).slice(2, 10);

let pass = 0,
  fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (ok) pass++;
  else fail++;
};

async function signup(email, password) {
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: r.status, body: await r.json() };
}

async function rest(path, { method = "GET", token, body, prefer } = {}) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = "travel_pins";
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch {}
  return { status: r.status, body: j };
}

const PLACES = [
  { label: "Lyon", category: "visited", lat: 45.7589, lng: 4.8414, country_code: "FR", region_code: null, locality: "Lyon" },
  { label: "Austin", category: "visited", lat: 30.2711, lng: -97.7437, country_code: "US", region_code: "TX", locality: "Austin" },
];

console.log(`\nTarget: ${BASE}\n`);

// --- User A: signup -> profile -> two pins -> read back ---
const emailA = `tp.a.${rnd()}@example.com`;
const A = await signup(emailA, "Test123456!");
check("A: signup returns a session (Confirm email is OFF)", !!A.body.access_token, A.body.access_token ? emailA : JSON.stringify(A.body));
if (!A.body.access_token) {
  console.log("\nCannot continue without a session. Is 'Confirm email' still on?\n");
  process.exit(1);
}
const tokenA = A.body.access_token;
const uidA = A.body.user.id;

const usernameA = `tp_${rnd()}`;
const pA = await rest("profiles", { method: "POST", token: tokenA, body: { id: uidA, username: usernameA }, prefer: "return=representation" });
check("A: profile insert under RLS", pA.status === 201, `HTTP ${pA.status}`);

const inserted = [];
for (const p of PLACES) {
  const r = await rest("places", { method: "POST", token: tokenA, body: { user_id: uidA, ...p }, prefer: "return=representation" });
  inserted.push(r);
  check(`A: insert pin "${p.label}" (${p.country_code}${p.region_code ? "/" + p.region_code : ""})`, r.status === 201, `HTTP ${r.status}`);
}

const readA = await rest("places?select=*&order=created_at.desc", { token: tokenA });
check("A: reads back own 2 pins", readA.status === 200 && readA.body.length === 2, `got ${readA.body?.length}`);
const lyon = (readA.body || []).find((p) => p.label === "Lyon");
check("A: Lyon stored with country_code FR, region_code null", lyon?.country_code === "FR" && lyon?.region_code === null);
const austin = (readA.body || []).find((p) => p.label === "Austin");
check("A: Austin stored with USPS region_code TX", austin?.country_code === "US" && austin?.region_code === "TX");

// --- User B: must NOT see A's friends-visibility pins (RLS) ---
const emailB = `tp.b.${rnd()}@example.com`;
const B = await signup(emailB, "Test123456!");
check("B: signup returns a session", !!B.body.access_token);
const tokenB = B.body.access_token;

const readB = await rest("places?select=*", { token: tokenB });
check("B: cannot see A's pins (RLS isolation)", readB.status === 200 && readB.body.length === 0, `got ${readB.body?.length}`);

// --- B tries to write a pin owned by A (RLS WITH CHECK must reject) ---
const spoof = await rest("places", { method: "POST", token: tokenB, body: { user_id: uidA, label: "spoof", lat: 0, lng: 0, country_code: "FR" }, prefer: "return=representation" });
check("B: cannot insert a pin owned by A (RLS WITH CHECK)", spoof.status === 401 || spoof.status === 403, `HTTP ${spoof.status}`);

console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${pass} passed, ${fail} failed`);
console.log(`(test users created: ${emailA}, ${emailB})\n`);
process.exit(fail === 0 ? 0 : 1);
