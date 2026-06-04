-- ============================================================================
-- Travel Pins — 0002 profiles (1:1 with auth.users)
-- RLS is enabled in the same migration that creates the table: the table never
-- exists in an unprotected state.
-- ============================================================================

create table travel_pins.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

grant select, insert, update, delete on travel_pins.profiles to authenticated, service_role;

alter table travel_pins.profiles enable row level security;

-- Any authenticated user can read profiles (needed to find/add friends in Phase 2).
create policy profiles_read on travel_pins.profiles
  for select using (auth.role() = 'authenticated');

-- A user can write only their own row. This also permits the onboarding
-- self-insert (WITH CHECK applies to INSERT).
create policy profiles_self_w on travel_pins.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
