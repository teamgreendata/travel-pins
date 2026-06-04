-- ============================================================================
-- Travel Pins — 0011 anon access for the public share RPC
-- ----------------------------------------------------------------------------
-- get_shared_map is granted to anon, but calling a function in travel_pins also
-- requires USAGE on the schema. Grant it. anon has NO table grants in
-- travel_pins, so this only enables the explicitly-granted share RPC — anon
-- still cannot read any table directly.
--
-- Defense-in-depth: revoke the default PUBLIC execute on the OTHER (authenticated-
-- only) functions so anon can't call them now that it has schema usage. They are
-- granted to `authenticated` explicitly, so that path is unaffected. (are_friends/
-- is_blocked keep PUBLIC execute — they're used inside RLS policies.)
-- ============================================================================

grant usage on schema travel_pins to anon;

revoke execute on function travel_pins.accept_companion(uuid) from public;
revoke execute on function travel_pins.companion_suggestions() from public;
revoke execute on function travel_pins.friend_overlap(uuid) from public;
