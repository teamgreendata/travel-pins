-- ============================================================================
-- Travel Pins — 0009 friend overlap RPC (Phase 2 M4, spec §9)
-- ----------------------------------------------------------------------------
-- Returns three country-code sets comparing the caller with a friend:
--   shared              = both visited           (me.visited ∩ friend.visited)
--   wishlist_match      = both want to visit     (me.wish    ∩ friend.wish)
--   been_where_you_want = they've been where you want to go (me.wish ∩ friend.visited)
--
-- SECURITY INVOKER: RLS does the work — the friend's side only includes pins the
-- caller may see (public, or 'friends' when accepted; nothing if blocked), and
-- the caller's side is their own pins. No privilege escalation, so no advisor warning.
-- ============================================================================

create or replace function travel_pins.friend_overlap(p_friend_id uuid)
returns table (kind text, country_code text)
language sql
stable
security invoker
set search_path = ''
as $$
  with me_v as (
    select distinct country_code as cc from travel_pins.places
    where user_id = auth.uid() and category <> 'want_to_visit'
  ),
  me_w as (
    select distinct country_code as cc from travel_pins.places
    where user_id = auth.uid() and category = 'want_to_visit'
  ),
  fr_v as (
    select distinct country_code as cc from travel_pins.places
    where user_id = p_friend_id and category <> 'want_to_visit'
  ),
  fr_w as (
    select distinct country_code as cc from travel_pins.places
    where user_id = p_friend_id and category = 'want_to_visit'
  )
  select 'shared'::text as kind, me_v.cc::text as country_code
    from me_v join fr_v on fr_v.cc = me_v.cc
  union all
  select 'wishlist_match'::text, me_w.cc::text
    from me_w join fr_w on fr_w.cc = me_w.cc
  union all
  select 'been_where_you_want'::text, me_w.cc::text
    from me_w join fr_v on fr_v.cc = me_w.cc;
$$;

grant execute on function travel_pins.friend_overlap(uuid) to authenticated;
