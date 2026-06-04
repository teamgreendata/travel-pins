-- ============================================================================
-- Travel Pins — 0006 shares (public read-only links; Phase 2 feature)
-- ----------------------------------------------------------------------------
-- Table ships now so Phase 2 needs no Phase-1-invalidating migration. The
-- ANONYMOUS read path is a Phase-2 SECURITY DEFINER RPC (homes hidden/fuzzed) —
-- NOT these authenticated policies. For Phase 1 we enable RLS with an owner-only
-- policy; there is no anon access yet.
-- ============================================================================

create table travel_pins.shares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references travel_pins.profiles(id) on delete cascade,
  slug       text unique not null,
  is_active  boolean not null default true,
  show_homes boolean not null default false,   -- privacy: hide/fuzz home pins by default
  created_at timestamptz not null default now()
);

create index shares_user_idx on travel_pins.shares (user_id);

grant select, insert, update, delete on travel_pins.shares to authenticated, service_role;

alter table travel_pins.shares enable row level security;

create policy shares_owner_all on travel_pins.shares
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
