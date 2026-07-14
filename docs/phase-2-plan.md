# Travel Pins — Phase 2 Plan (Social + Sharing)

**Status:** shipped — P2-M1 through P2-M5 are implemented on `main` (routes `/friends`,
`/u/[username]`, `/u/[username]/overlap`, `/s/[slug]`; migrations `0007`–`0011`). Only
P2-M6 (PNG export) remains deferred. This doc is kept as the design record.
**Source of truth:** `travel-map-app-handoff.md` §3, §6, §9, §10, §11, §12.

## Context

Phase 2 turns the solo app into a social one: friends, tagging companions on a
pin (with an opt-in mirror), a friend-overlap view, and a public read-only share
link. The Phase-1 schema **already contains every Phase-2 table** (`friendships`,
`place_companions`, `shares`) with RLS policies and the `are_friends()` helper and
`owner_id` trigger — so no Phase-1-invalidating migration is needed. Phase 2 is
mostly UI + a few additive RLS refinements + three `security definer` RPCs.

**Phase 2 acceptance (spec §12):** two users can become friends, tag a shared pin,
and the companion can opt that pin onto their own map; a friend's map respects
visibility and never leaks precise home coordinates; a public link renders
read-only without exposing homes.

## Already in place (from Phase 1)

- `friendships` (+ direction-agnostic unique pair), `place_companions` (+ owner_id
  trigger), `shares` tables — all RLS-enabled.
- Policies: `fr_read/fr_request/fr_respond`, `pc_read/pc_owner_tag/pc_owner_del/
  pc_companion_respond`, `shares_owner_all`, `places_friends_read`.
- `are_friends(a,b)` helper; `profiles_read` (any authed user can search profiles).
- Per-pin `visibility` (private/friends/public) and `is_home` already captured by the
  Phase-1 add/edit form.

## Cross-cutting work (do first)

**A. Read-only map mode.** Friend maps and the public share page need a *non-editable*
map (display + legend + year filter; no search/add, no click-to-edit). Refactor
`MapClient` to accept `editable?: boolean` (default true) and skip the add/edit/search
UI + marker click-to-edit when false — reusing the existing markers, choropleth, and
legend. (Alternative: extract a `ReadOnlyMap`; refactoring the existing component is
less duplication.)

**B. RLS refinement migration** (`0007_travel_pins_social.sql`):
- `is_blocked(a,b)` helper (a `friendships` row for the pair with `status='blocked'`).
- Refine `places_friends_read` so blocked users see **nothing** (even `public`):
  `(visibility='public' OR (visibility='friends' AND are_friends(auth.uid(),user_id)))
   AND NOT is_blocked(auth.uid(), user_id)`.
- Allow **either party** to set a friendship to `blocked` (current `fr_respond` only
  lets the addressee update); unblock = delete the row.

## Milestones

### P2-M1 — Friendships (foundation)
Friend search by username, send/accept/decline requests, friends list, block/unblock.
- **UI:** `/friends` — username search (uses `profiles_read`), incoming/outgoing
  requests, accepted-friends list, block/unblock.
- **Data:** existing `friendships` policies + the M0 blocking refinement.
- **Accept:** verify status (`fr_respond`). Mutual-accept = `status='accepted'`.
- **Verify:** two accounts can friend each other; blocking hides both directions
  (including public pins) — confirm via RLS round-trip test.

### P2-M2 — View a friend's map (read-only)
- **Route:** `/u/[username]` (read-only world+US views via the cross-cutting read-only
  mode). Loads the friend's pins through RLS (`places_friends_read` returns only
  `public` + (`friends` when accepted), and nothing when blocked).
- **Home privacy:** show `is_home` pins per the pin's own visibility (no fuzzing) —
  friends are trusted; `private` homes stay hidden via RLS. Hiding/fuzzing is
  public-link-only.
- **Verify:** friend sees `friends`+`public` pins; non-friend sees only `public`;
  blocked sees none.

### P2-M3 — Companion tagging (opt-in mirror, spec §10)
- **Tag:** on the owner's pin edit panel, "Tag friends" lists accepted friends →
  inserts `place_companions` (status `suggested`; `owner_id` set by trigger). The tag is
  immediately visible on the owner's pin and (read-only) on the friend's view.
- **Suggestions inbox:** the tagged friend sees "Rob added you to *Lyon (2019)* — add
  it to your map?" → **Accept** or **Decline**.
- **Accept = `security definer` RPC `accept_companion(pc_id)`** (RECOMMENDED): verifies
  caller is the companion, copies the owner's pin coords/locality into a **new pin owned
  by the caller** (their own category/visibility defaults), sets `mirrored_place_id` +
  `status='accepted'`. An RPC keeps it atomic and avoids broadly exposing the owner's
  coordinates.
- **Decline:** `status='declined'`; annotation stays on the owner's pin, nothing written
  to the friend's map.
- **Untag:** owner deletes the `place_companions` row; the friend's accepted mirror is
  left intact (`mirrored_place_id ON DELETE SET NULL`).
- **Verify (core acceptance):** tag → friend accepts → mirrored pin appears on the
  friend's map; untag leaves it intact.

### P2-M4 — Friend-overlap view (spec §9)
Compare me vs a friend:
- **Shared countries:** `me.visited ∩ friend.visited` (exclude `want_to_visit`).
- **Wishlist match:** `me.want_to_visit ∩ friend.want_to_visit`.
- **"They've been where you want to go":** `me.want_to_visit ∩ friend.visited` — a prompt
  to message them for tips.
- **Impl:** `friend_overlap(friend_id)` `security definer` RPC — server-side intersection,
  RLS-correct.

### P2-M5 — Public read-only share link (spec §6, §11)
- **Manage:** UI (in passport/settings) to create a share — generates a `slug`, toggles
  `is_active` and `show_homes` (uses `shares_owner_all`).
- **Public page:** `/s/[slug]` — **no auth**. Renders the read-only map from a
  `security definer` RPC `get_shared_map(slug)` (execute granted to `anon`) that:
  returns the user's `visibility='public'` pins; includes `is_home` pins **only if**
  `show_homes`, with coordinates **fuzzed to ~city level server-side**; returns
  display_name/username for the header. Anonymous visitors never hit the authenticated
  policies.
- **Home-fuzzing:** round home lat/lng to ~2 decimals (~1 km) server-side. Never expose a
  precise home coordinate over a public link.
- **Verify (acceptance):** public link renders read-only; homes hidden by default, fuzzed
  when `show_homes`; private/friends pins never appear.

### P2-M6 — PNG export (DEFERRED to a later pass)
- Add `preserveDrawingBuffer: true` to the MapLibre map; an "Export PNG" button calls
  `canvas.toDataURL()`. One-line map-option change + a button; no migration.

## New DB objects (all additive)
- Migration `0007_travel_pins_social.sql`: `is_blocked()`, refined `places_friends_read`,
  blocking write policy.
- RPCs (`security definer`, `search_path` pinned): `accept_companion(pc_id)`,
  `get_shared_map(slug)` (+ `anon` execute), optional `friend_overlap(friend_id)`.

## Decisions (resolved)
1. **Home pins on a friend's map** — show per the pin's own visibility; do **not** fuzz
   (friends are trusted; `visibility='private'` already hides a home via RLS). Hiding +
   fuzzing is reserved for public share links.
2. **Friend-map route** — `/u/[username]`.
3. **Overlap impl** — `friend_overlap(friend_id)` `security definer` RPC (server-side
   intersection, RLS-correct).
4. **Home-fuzzing** — round home lat/lng to ~2 decimals (~1 km) server-side in the share RPC.
5. **Notifications** — on-load fetch (no Realtime) for v1.
6. **PNG export (M6)** — deferred to a later pass.

## Suggested order
Cross-cutting (read-only mode + RLS migration) → M1 → M2 → M3 → M4 → M5 → (M6).
M1 is the foundation for M2/M3/M4; M5 (public share) is independent and could slot
anywhere after the read-only map exists.
