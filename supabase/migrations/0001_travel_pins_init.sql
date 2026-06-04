-- ============================================================================
-- Travel Pins — 0001 init: schema, enums, grants
-- ----------------------------------------------------------------------------
-- Travel Pins lives in its OWN Postgres schema (travel_pins) inside the shared
-- "green phoenix" database. The ONLY object shared with green phoenix is
-- auth.users. Nothing here references or touches green phoenix's own tables.
--
-- Deviations from handoff spec §5 (deliberate, flagged):
--   * UUID PKs use core gen_random_uuid() instead of uuid-ossp's
--     uuid_generate_v4(). No "uuid-ossp" extension is added to the shared DB,
--     avoiding extension-schema/search_path surprises. gen_random_uuid() is
--     built into Postgres 13+ (this DB is PG17).
--   * profiles.username is plain text (not citext). The spec's own format check
--     ^[a-z0-9_]{3,30}$ forbids uppercase, so a unique text column is already
--     functionally case-insensitive — no citext extension needed.
-- ============================================================================

create schema if not exists travel_pins;

-- Enums (scoped to travel_pins so they can never collide with green phoenix)
create type travel_pins.place_category    as enum ('lived','visited','want_to_visit','passed_through');
create type travel_pins.place_visibility  as enum ('private','friends','public');
create type travel_pins.friendship_status as enum ('pending','accepted','blocked');
create type travel_pins.companion_status  as enum ('suggested','accepted','declined');

-- PostgREST roles need USAGE on the schema to resolve it; RLS governs row access.
-- No grants to `anon`: Phase 1 has zero anonymous access. The Phase 2 public-share
-- read path will be a SECURITY DEFINER RPC that exposes only what it should.
grant usage on schema travel_pins to authenticated, service_role;
