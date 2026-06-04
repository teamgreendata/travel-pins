# Travel Map App — Build Handoff

**Audience:** Claude Code (implementation agent)
**Status:** Approved spec, ready to build
**Owner decisions:** all locked (see §3)

---

## 1. What we're building

A web app where a user logs places they've **lived in / visited / want to visit / passed through**, and sees them as colored pins on two maps:

- a **world map** where visited countries are filled in (choropleth), and
- a **United States map** where visited states are filled in.

Users can add friends (mutual accept), view friends' maps, and **tag friends onto a specific pin** when they were there together. Tagging a friend shows the association on both maps immediately and offers the friend a one-tap way to add that pin to *their own* map.

The app also surfaces **travel stats** (a "passport" view), supports a **date per place**, is built so a **read-only public share link** can be added cleanly, and includes a **friend-overlap view** (places you've both been, wishlist matches).

### Core architectural principle (read this first)

**Every entry is a single geocoded point.** The country fill and US-state fill are **derived** from those points, never stored separately. One pin in Lyon → France lights up on the world map and nothing on the US map. One pin in Austin → the US lights up *and* Texas lights up. This means one source of truth, precise pins, and the "color in the map" effect with no duplicate data to keep in sync. Do not model countries/states as primary entities — they are aggregations of `places`.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript + Tailwind** | Matches the owner's existing Vercel/Supabase setup; adapt if the existing repo differs. |
| Hosting | **Vercel (Hobby/free tier)** | Owner's standing preference; scale here is tiny. |
| Backend / DB / Auth | **Supabase (Postgres + Auth + RLS)** | Owner's home turf. RLS enforces all visibility rules. |
| Map renderer | **MapLibre GL JS** | Open-source, MIT, no API key for the renderer itself. |
| Map tiles | **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`) | **No key, no card, no account, unlimited.** Honors the "zero billing surface" goal. |
| Geocoding | **Nominatim (OSM)** for v1; MapTiler as documented swap | See §7 — one real tradeoff to be aware of. |
| Boundary data | **world-atlas / Natural Earth** (countries), **US Census cartographic boundaries** (states) | Free GeoJSON/TopoJSON. See §8 for the ISO gotcha. |

**PostGIS is optional and NOT required for v1.** The derived fill is plain relational aggregation on text columns (`country_code`, `region_code`), not spatial math. Only add PostGIS if/when you want "places near me," distance queries, or point-in-polygon validation. Storing `lat`/`lng` as `double precision` is enough to render pins.

---

## 3. Locked decisions

1. **Friend tagging behavior = "association + opt-in nudge."** Tagging a friend on a pin creates a visible association on *both* maps immediately. It does **not** silently write to the friend's data. The friend receives a suggestion they can accept to mirror the pin onto their own map. (Never auto-create pins on another user's map.)
2. **Categories (fixed for v1):** `Lived`, `Visited`, `Want to visit`, `Passed through`.
3. **Map stack:** MapLibre + OpenFreeMap (per §2).
4. **All four value-adds are in:** stats/passport, date-per-place, share-ready data model, friend-overlap view.
5. **Phased build:** Phase 1 = solo experience end-to-end and fun on its own. Phase 2 = social + sharing.

---

## 4. Pin categories & palette

The entire app *is* the color coding, so the palette must be **colorblind-safe** (Okabe–Ito), and color must not be the *only* channel — pair each category with a distinct marker icon.

| Category | Enum value | Hex | Marker icon |
|---|---|---|---|
| Lived | `lived` | `#D55E00` (vermillion) | house |
| Visited | `visited` | `#0072B2` (blue) | filled dot/check |
| Want to visit | `want_to_visit` | `#009E73` (green) | star/flag |
| Passed through | `passed_through` | `#CC79A7` (reddish purple) | small ring |

These four are well-separated under protanopia/deuteranopia/tritanopia. Render a **legend with toggle filters** so the user can show/hide categories on each map. For the choropleth country/state fill, fill by the user's "strongest" category for that region (suggested precedence: lived > visited > passed through; `want_to_visit` should **not** fill a country — a wish is not a visit, show it only as a pin).

---

## 5. Data model (Postgres DDL)

```sql
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists citext;
-- postgis: optional, not needed for v1 (see §2)

-- Enums
create type place_category   as enum ('lived','visited','want_to_visit','passed_through');
create type place_visibility as enum ('private','friends','public');
create type friendship_status as enum ('pending','accepted','blocked');
create type companion_status  as enum ('suggested','accepted','declined');

-- Profiles (1:1 with auth.users)
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     citext unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

-- Places (the pins) — single source of truth
create table places (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references profiles(id) on delete cascade,
  label        text not null,                       -- "Lyon", "Austin, TX"
  category     place_category not null default 'visited',
  lat          double precision not null,
  lng          double precision not null,
  country_code char(2) not null,                    -- ISO 3166-1 alpha-2 (from geocoder)
  region_code  text,                                -- USPS 2-letter for US states, else null
  locality     text,                                -- city/town (from geocoder)
  visited_on   date,                                -- nullable time dimension
  notes        text,
  is_home      boolean not null default false,      -- drives home-fuzzing on shared views
  visibility   place_visibility not null default 'friends',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on places (user_id);
create index on places (user_id, country_code);
create index on places (user_id, region_code) where country_code = 'US';

-- Friendships (one row per pair, direction-agnostic uniqueness)
create table friendships (
  id           uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status       friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friend check (requester_id <> addressee_id)
);
create unique index friendships_unique_pair
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- Companions tagged on a pin (option C: opt-in mirror)
create table place_companions (
  id                uuid primary key default uuid_generate_v4(),
  place_id          uuid not null references places(id) on delete cascade,
  owner_id          uuid not null references profiles(id) on delete cascade,  -- owner of place_id (denormalized for RLS)
  companion_id      uuid not null references profiles(id) on delete cascade,  -- the tagged friend
  status            companion_status not null default 'suggested',
  mirrored_place_id uuid references places(id) on delete set null,            -- companion's own pin, once accepted
  created_at        timestamptz not null default now(),
  constraint no_self_tag check (owner_id <> companion_id),
  unique (place_id, companion_id)
);
create index on place_companions (companion_id, status);
create index on place_companions (place_id);

-- Public share links (Phase 2 feature, table can ship in Phase 1)
create table shares (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  slug       text unique not null,
  is_active  boolean not null default true,
  show_homes boolean not null default false,   -- privacy: hide/fuzz home pins by default
  created_at timestamptz not null default now()
);
```

Keep `place_companions.owner_id` in sync with `places.user_id` via a `before insert` trigger (or set it in the insert RPC) so RLS can authorize without a join on every check.

---

## 6. Row-Level Security (enable on every table)

```sql
-- Helper: accepted-friends check
create or replace function are_friends(a uuid, b uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

-- PROFILES: any authenticated user can read (needed to find/add friends); self can write
alter table profiles enable row level security;
create policy profiles_read   on profiles for select using (auth.role() = 'authenticated');
create policy profiles_self_w on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- PLACES: owner full access; friends read 'friends'/'public'
alter table places enable row level security;
create policy places_owner_all on places for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy places_friends_read on places for select using (
  visibility = 'public'
  or (visibility = 'friends' and are_friends(auth.uid(), user_id))
);

-- FRIENDSHIPS: parties can see; requester inserts; addressee responds
alter table friendships enable row level security;
create policy fr_read    on friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy fr_request on friendships for insert
  with check (requester_id = auth.uid() and are_friends(requester_id, addressee_id) = false);
create policy fr_respond on friendships for update
  using (addressee_id = auth.uid());

-- PLACE_COMPANIONS: owner tags accepted friends; companion accepts/declines; both can read
alter table place_companions enable row level security;
create policy pc_read on place_companions for select
  using (owner_id = auth.uid() or companion_id = auth.uid());
create policy pc_owner_tag on place_companions for insert
  with check (owner_id = auth.uid() and are_friends(owner_id, companion_id));
create policy pc_owner_del on place_companions for delete
  using (owner_id = auth.uid());
create policy pc_companion_respond on place_companions for update
  using (companion_id = auth.uid());
```

**Public share links** must NOT rely on the authenticated policies above (anonymous visitors have no `auth.uid()`). Implement public read as a `security definer` RPC that takes a `slug`, looks up the active share, and returns that user's `public` (and, only if `show_homes`, home) pins — with home pins coordinate-fuzzed server-side. This keeps RLS strict while still allowing a safe anonymous read path.

---

## 7. Geocoding flow

When the user adds a place, a search box geocodes free text into a result that already carries everything we need:

- `lat`, `lng`
- `country_code` (ISO alpha-2)
- region/state → store the **USPS 2-letter code** in `region_code` when `country_code = 'US'`, else `null`
- `locality` (city/town)

So **no separate reverse-geocode step is required** — capture these fields from the geocoder result at insert time.

**The one tradeoff to be aware of:** Nominatim is free and keyless but its usage policy forbids heavy autocomplete-on-every-keystroke use and caps at ~1 request/sec with required attribution. For v1, implement **debounced search-on-submit** (≈400 ms debounce, search triggered on pause/enter, not per keystroke) against Nominatim to stay fully keyless and within policy. If you later want true type-ahead autocomplete, **MapTiler geocoding** (free tier, no credit card, requires a key) is a clean drop-in — gate it behind a `MAPTILER_KEY` env var so v1 needs no extra accounts beyond Supabase.

---

## 8. Map rendering notes

**World fill:** load country polygons as a GeoJSON/TopoJSON source. Drive `fill-color` with MapLibre **feature-state** (set state per country from the user's visited set) rather than rebuilding the style on every change — much faster.

**ISO code gotcha (do not skip):** raw Natural Earth `ISO_A2` has `-99`/missing values for several territories (France, Norway, and others historically). Use a cleaned dataset (e.g. `world-atlas`, or join on `ISO_A3`, or a curated name→ISO map) so those countries actually light up. Validate against a test set that includes France before calling the world map done.

**US fill:** use US Census cartographic boundary files (e.g. `cb_20m` states). They key states by **STUSPS** (USPS 2-letter) and **STATEFP** (FIPS). Match on `STUSPS` to your stored `region_code`. Don't confuse FIPS with USPS.

**Two map views:** world and US are separate views/routes sharing the same `places` data and the same legend/filter component. The US view filters to `country_code = 'US'`.

---

## 9. Derived views (fill + stats + overlap)

```sql
-- Country fill per user
create view user_country_fill as
  select user_id, country_code, count(*) as place_count,
         min(visited_on) as first_visit, max(visited_on) as last_visit
  from places
  where category <> 'want_to_visit'   -- wishes don't fill a country
  group by user_id, country_code;

-- US state fill per user
create view user_state_fill as
  select user_id, region_code, count(*) as place_count
  from places
  where country_code = 'US' and region_code is not null and category <> 'want_to_visit'
  group by user_id, region_code;

-- Passport / stats per user
create view user_stats as
  select user_id,
    count(distinct country_code)                                  as countries,
    count(distinct region_code) filter (where country_code='US')  as us_states,
    count(*)                                                       as total_places,
    count(*) filter (where category='lived')                      as lived_count,
    count(*) filter (where category='want_to_visit')              as wishlist_count
  from places group by user_id;
```

- **% of world** = `countries / 195` (UN member + observer states). Display as a friendly fraction/percent.
- **Continents cleared** needs a small static `country_code → continent` lookup table — add it when you build stats; it's a fixed reference, not user data.

**Friend overlap (Phase 2):**
```sql
-- Countries you've BOTH visited
select country_code from places where user_id = :me   and category <> 'want_to_visit'
intersect
select country_code from places where user_id = :friend and category <> 'want_to_visit';
```
Also compute two social hooks: **wishlist match** (`:me` want_to_visit ∩ `:friend` want_to_visit) and **"they've been where you want to go"** (`:me` want_to_visit ∩ `:friend` visited) — the latter is a great prompt to message a friend for tips.

---

## 10. Friend-tagging flow (option C, step by step)

1. On any of the owner's pins, the owner can tag **accepted friends only**.
2. Tagging inserts a `place_companions` row, `status = 'suggested'`. The association is **immediately visible on both** the owner's pin and (read-only) on the friend's view of that pin.
3. The tagged friend sees a **suggestion**: "Rob added you to *Lyon (2019)*. Add it to your map too?"
4. On **accept**: create a new `places` row owned by the friend (same coords/locality, their own category/visibility defaults), set `place_companions.mirrored_place_id` to it, `status = 'accepted'`.
5. On **decline**: `status = 'declined'`; the association stays as an annotation on the owner's pin but nothing is written to the friend's map.
6. Untagging (owner deletes the row) removes the association; the friend's already-accepted mirrored pin is **left intact** (it's theirs now) — `on delete set null` handles the link cleanly.

---

## 11. Privacy

- **Per-pin visibility** (`private` / `friends` / `public`) is built into the schema from day one. Default `friends`.
- **Home locations are the most sensitive data in the app.** `is_home = true` pins are hidden by default on any shared/public view, and when shown (via `shares.show_homes`) they must be **coordinate-fuzzed to ~city level** server-side in the public RPC — never expose a precise home coordinate over a public link.
- Blocked relationships (`friendship_status = 'blocked'`) must hide both directions everywhere.

---

## 12. Phasing

### Phase 1 — Solo experience (ship this complete and enjoyable before any social work)
- Supabase auth (email; optionally one OAuth provider) + profile/username creation.
- Add place: debounced geocode search → pick result → set category, date (optional), notes, home toggle, visibility → save.
- Edit / delete places.
- **World map**: pins + country choropleth fill (validate France lights up).
- **US map**: pins + state choropleth fill.
- Category **legend with show/hide filters** on both maps; colorblind-safe palette + distinct icons.
- **Stats / passport panel**: countries, US states, total places, % of world, wishlist count.
- Date display + basic "filter by year."

**Phase 1 acceptance:** a single user can log places and watch both maps fill correctly with correct pin colors/icons, edit/remove them, filter by category and year, and see accurate stats. No friends features required to be useful.

### Phase 2 — Social + sharing
- Friend search by username; request / accept / decline; friends list; block.
- View a friend's map (respecting `visibility` + home-fuzzing + block).
- Companion tagging (option C flow, §10).
- **Friend-overlap view**: shared countries, wishlist matches, "been where you want to go."
- **Public read-only share link** (slug-based, security-definer RPC, homes hidden/fuzzed).
- *Optional:* PNG export of a map for sharing.

**Phase 2 acceptance:** two users can become friends, tag a shared pin, and the companion can opt that pin onto their own map; a friend's map respects visibility and never leaks precise home coordinates; a public link renders read-only without exposing homes.

---

## 13. Build conventions for Claude Code

- **Migrations:** plain SQL migration files under Supabase migrations; one logical change per migration.
- **RLS on from the first migration.** Never use the service-role key in client code. Anonymous/public reads go only through the security-definer share RPC.
- **Keep `owner_id` in sync** on `place_companions` via trigger or the insert path.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (server-only service key kept server-side if used at all). OpenFreeMap needs none. `MAPTILER_KEY` only if/when autocomplete geocoding is added.
- **Deploy:** Vercel Hobby. If a scraper/geocoding batch job is ever needed it can move to a scheduled job, but v1 needs nothing beyond Vercel + Supabase.
- Map fill must use **feature-state**, not full style rebuilds, for performance.

---

## 14. Open items / deliberately deferred

- **Date ranges for "Lived"** (e.g., 2010–2014). v1 uses a single nullable `visited_on`; add a `visited_end date` + precision flag later if wanted.
- **Trips:** grouping multiple pins under a named trip ("Italy 2023"). Nice future feature; would add a `trips` table referenced by `places`.
- **Photos on pins:** appealing but introduces storage cost/moderation; defer past v1.
- **Continents lookup table:** add the static reference when building the stats panel.
- **Mobile / PWA polish:** the map UX should be touch-friendly; full native is out of scope.

---

*End of handoff. Phase 1 is the contract; Phase 2 builds on the same schema with no migrations that invalidate Phase 1 data.*
