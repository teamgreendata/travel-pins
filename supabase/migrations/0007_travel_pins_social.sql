-- ============================================================================
-- Travel Pins — 0007 social: blocking + read refinement (Phase 2 foundation)
-- ----------------------------------------------------------------------------
-- Adds correct block/unblock semantics and ensures a blocked user sees NOTHING
-- of the other's pins — not even `public` ones (spec §11: "blocked relationships
-- must hide both directions everywhere"). All changes are additive; friendships
-- is empty, so no Phase-1 data is affected.
--
-- Deviation from spec §5 (flagged): the spec's friendships has no `blocked_by`,
-- so only the blocker can unblock can't be enforced. We add a nullable
-- `blocked_by` column to record who blocked, and tighten `fr_respond` so the
-- accept/decline path can't be used to set `blocked` without stamping blocked_by.
-- ============================================================================

alter table travel_pins.friendships
  add column blocked_by uuid references travel_pins.profiles(id) on delete cascade;

-- Blocked-pair check (direction-agnostic). Used by the places read policy.
create or replace function travel_pins.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from travel_pins.friendships
    where status = 'blocked'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

-- Refine the places read policy: a blocked user sees NOTHING of the other's pins.
drop policy places_friends_read on travel_pins.places;
create policy places_friends_read on travel_pins.places
  for select using (
    not travel_pins.is_blocked(auth.uid(), user_id)
    and (
      visibility = 'public'
      or (visibility = 'friends' and travel_pins.are_friends(auth.uid(), user_id))
    )
  );

-- Tighten accept/decline so it can't set `blocked` (that must go through fr_block,
-- which stamps blocked_by). Addressee still accepts/declines.
drop policy fr_respond on travel_pins.friendships;
create policy fr_respond on travel_pins.friendships
  for update
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status <> 'blocked');

-- Either party can block, but the new row must mark THEM as the blocker.
create policy fr_block on travel_pins.friendships
  for update
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (status = 'blocked' and blocked_by = auth.uid());

-- Either party can remove a non-blocked relationship (unfriend / withdraw);
-- only the blocker can delete a blocked row (i.e. unblock).
create policy fr_delete on travel_pins.friendships
  for delete using (
    (status <> 'blocked' and (requester_id = auth.uid() or addressee_id = auth.uid()))
    or (status = 'blocked' and blocked_by = auth.uid())
  );
