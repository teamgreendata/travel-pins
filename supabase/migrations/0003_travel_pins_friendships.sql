-- ============================================================================
-- Travel Pins — 0003 friendships + are_friends() helper
-- ----------------------------------------------------------------------------
-- Schema ships in Phase 1 so Phase 2 needs no Phase-1-invalidating migration;
-- friendship FEATURES are Phase 2. The are_friends() helper is referenced by the
-- places friends-read policy (0004), so it must exist before that migration.
-- ============================================================================

create table travel_pins.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references travel_pins.profiles(id) on delete cascade,
  addressee_id uuid not null references travel_pins.profiles(id) on delete cascade,
  status       travel_pins.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friend check (requester_id <> addressee_id)
);

-- One row per pair, direction-agnostic uniqueness.
create unique index friendships_unique_pair
  on travel_pins.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

grant select, insert, update, delete on travel_pins.friendships to authenticated, service_role;

-- Accepted-friends check (used by places + place_companions policies).
-- search_path='' + fully-qualified names: resolves regardless of caller search_path
-- and is injection-safe. SECURITY INVOKER (default): the friendships rows it reads
-- always involve the calling user, so the caller's RLS permits them.
create or replace function travel_pins.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from travel_pins.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

alter table travel_pins.friendships enable row level security;

create policy fr_read on travel_pins.friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy fr_request on travel_pins.friendships
  for insert with check (
    requester_id = auth.uid()
    and travel_pins.are_friends(requester_id, addressee_id) = false
  );

create policy fr_respond on travel_pins.friendships
  for update using (addressee_id = auth.uid());
