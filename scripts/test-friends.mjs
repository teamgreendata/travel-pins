// M1 (Phase 2) acceptance: friendship + blocking RLS round-trip through the live
// GoTrue + PostgREST API. Proves request -> accept -> friend can read 'friends'
// pins -> block hides EVERYTHING (incl. public) -> blocked party can't unblock ->
// blocker unblocks. Run: node scripts/test-friends.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const rnd = () => Math.random().toString(36).slice(2, 10);

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (ok) pass++; else fail++;
};

async function signup(email) {
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test123456!" }),
  });
  return r.json();
}
async function rest(path, { method = "GET", token, body, prefer } = {}) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = "travel_pins";
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${BASE}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

const A = await signup(`tp.fa.${rnd()}@example.com`);
const B = await signup(`tp.fb.${rnd()}@example.com`);
check("signups return sessions (Confirm email off)", !!A.access_token && !!B.access_token);
if (!A.access_token || !B.access_token) { console.log("\nCannot continue (Confirm email may be on)."); process.exit(1); }
const [ta, ua] = [A.access_token, A.user.id];
const [tb, ub] = [B.access_token, B.user.id];

await rest("profiles", { method: "POST", token: ta, body: { id: ua, username: `fa_${rnd()}` } });
await rest("profiles", { method: "POST", token: tb, body: { id: ub, username: `fb_${rnd()}` } });

// B has a 'friends'-visibility pin
await rest("places", { method: "POST", token: tb, body: { user_id: ub, label: "B-friends", category: "visited", lat: 51.5, lng: -0.1, country_code: "GB", visibility: "friends" } });

// Before friendship: A cannot see B's friends pin
const r1 = await rest("places?select=id", { token: ta });
check("strangers can't see each other's 'friends' pins", r1.body?.length === 0, `got ${r1.body?.length}`);

// A -> B request, B accepts
const req = await rest("friendships", { method: "POST", token: ta, body: { requester_id: ua, addressee_id: ub, status: "pending" }, prefer: "return=representation" });
check("A can send a friend request", req.status === 201, `HTTP ${req.status}`);
const fid = req.body?.[0]?.id;
const inbox = await rest(`friendships?select=id,requester_id&status=eq.pending`, { token: tb });
check("B sees the incoming request", inbox.body?.some((f) => f.requester_id === ua));
const acc = await rest(`friendships?id=eq.${fid}`, { method: "PATCH", token: tb, body: { status: "accepted" }, prefer: "return=representation" });
check("B can accept", acc.body?.[0]?.status === "accepted", `HTTP ${acc.status}`);

// Now friends: A sees B's 'friends' pin
const r2 = await rest("places?select=label", { token: ta });
check("accepted friend can read 'friends' pins", r2.body?.length === 1 && r2.body[0].label === "B-friends", `got ${JSON.stringify(r2.body)}`);

// A also has a PUBLIC pin (to test that blocking hides even public)
await rest("places", { method: "POST", token: ta, body: { user_id: ua, label: "A-public", category: "visited", lat: 48.85, lng: 2.35, country_code: "FR", visibility: "public" } });

// A blocks B
const blk = await rest(`friendships?id=eq.${fid}`, { method: "PATCH", token: ta, body: { status: "blocked", blocked_by: ua }, prefer: "return=representation" });
check("A can block (stamping blocked_by)", blk.body?.[0]?.status === "blocked", `HTTP ${blk.status}`);

// Blocked: A can't see B's pins; B can't see A's pins (not even public)
const r3 = await rest("places?select=id", { token: ta });
check("blocker no longer sees blocked user's pins", r3.body?.length === 0, `got ${r3.body?.length}`);
const r4 = await rest("places?select=id", { token: tb });
check("blocked user can't see blocker's pins (incl. public)", r4.body?.length === 0, `got ${r4.body?.length}`);

// B (blocked) cannot unblock by deleting the row
await rest(`friendships?id=eq.${fid}`, { method: "DELETE", token: tb });
const stillBlocked = await rest(`friendships?id=eq.${fid}&select=status`, { token: tb });
check("blocked user can't delete the block", stillBlocked.body?.[0]?.status === "blocked");

// A (blocker) unblocks by deleting; B can then see A's PUBLIC pin only
await rest(`friendships?id=eq.${fid}`, { method: "DELETE", token: ta });
const r5 = await rest("places?select=label", { token: tb });
check("after unblock, B sees A's public pin only", r5.body?.length === 1 && r5.body[0].label === "A-public", `got ${JSON.stringify(r5.body)}`);

console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"}: ${pass} passed, ${fail} failed`);
console.log(`(test users: ${A.user.email}, ${B.user.email})`);
process.exit(fail ? 1 : 0);
