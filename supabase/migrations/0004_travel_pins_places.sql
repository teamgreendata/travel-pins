-- ============================================================================
-- Travel Pins — 0004 places (the pins; the single source of truth)
-- ----------------------------------------------------------------------------
-- Country and US-state choropleth fills are DERIVED from these rows (see the
-- fill views added in a later milestone). Countries/states are never modeled as
-- primary entities.
-- ============================================================================

create table travel_pins.places (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references travel_pins.profiles(id) on delete cascade,
  label        text not null,                       -- "Lyon", "Austin, TX"
  category     travel_pins.place_category not null default 'visited',
  lat          double precision not null,
  lng          double precision not null,
  country_code char(2) not null,                    -- ISO 3166-1 alpha-2 (from geocoder)
  region_code  text,                                -- USPS 2-letter for US states, else null
  locality     text,                                -- city/town (from geocoder)
  visited_on   date,                                -- nullable time dimension
  notes        text,
  is_home      boolean not null default false,      -- drives home-fuzzing on shared views
  visibility   travel_pins.place_visibility not null default 'friends',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index places_user_idx         on travel_pins.places (user_id);
create index places_user_country_idx on travel_pins.places (user_id, country_code);
create index places_user_region_idx  on travel_pins.places (user_id, region_code) where country_code = 'US';

grant select, insert, update, delete on travel_pins.places to authenticated, service_role;

alter table travel_pins.places enable row level security;

-- Owner has full access to their own pins.
create policy places_owner_all on travel_pins.places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Friends may read 'public' pins, or 'friends' pins of accepted friends.
create policy places_friends_read on travel_pins.places
  for select using (
    visibility = 'public'
    or (visibility = 'friends' and travel_pins.are_friends(auth.uid(), user_id))
  );
