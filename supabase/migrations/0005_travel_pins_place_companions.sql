-- ============================================================================
-- Travel Pins — 0005 place_companions (Phase 2 feature; schema ships now)
-- ----------------------------------------------------------------------------
-- owner_id is denormalized (= places.user_id) so RLS can authorize without a
-- join. A BEFORE INSERT trigger keeps owner_id in sync with the place's owner.
-- (Companion FEATURES — tagging UI, opt-in mirror — are Phase 2.)
-- ============================================================================

create table travel_pins.place_companions (
  id                uuid primary key default gen_random_uuid(),
  place_id          uuid not null references travel_pins.places(id) on delete cascade,
  owner_id          uuid not null references travel_pins.profiles(id) on delete cascade,  -- = places.user_id
  companion_id      uuid not null references travel_pins.profiles(id) on delete cascade,  -- the tagged friend
  status            travel_pins.companion_status not null default 'suggested',
  mirrored_place_id uuid references travel_pins.places(id) on delete set null,            -- companion's own pin, once accepted
  created_at        timestamptz not null default now(),
  constraint no_self_tag check (owner_id <> companion_id),
  unique (place_id, companion_id)
);

create index place_companions_companion_idx on travel_pins.place_companions (companion_id, status);
create index place_companions_place_idx     on travel_pins.place_companions (place_id);

grant select, insert, update, delete on travel_pins.place_companions to authenticated, service_role;

-- Keep owner_id in sync with the place's owner. RLS WITH CHECK runs AFTER this
-- BEFORE trigger, so pc_owner_tag effectively asserts the tagger owns the place.
create or replace function travel_pins.set_companion_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select p.user_id into new.owner_id
  from travel_pins.places p
  where p.id = new.place_id;
  return new;
end;
$$;

create trigger trg_set_companion_owner
  before insert on travel_pins.place_companions
  for each row execute function travel_pins.set_companion_owner();

alter table travel_pins.place_companions enable row level security;

create policy pc_read on travel_pins.place_companions
  for select using (owner_id = auth.uid() or companion_id = auth.uid());

create policy pc_owner_tag on travel_pins.place_companions
  for insert with check (owner_id = auth.uid() and travel_pins.are_friends(owner_id, companion_id));

create policy pc_owner_del on travel_pins.place_companions
  for delete using (owner_id = auth.uid());

create policy pc_companion_respond on travel_pins.place_companions
  for update using (companion_id = auth.uid());
