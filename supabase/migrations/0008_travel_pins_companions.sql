-- ============================================================================
-- Travel Pins — 0008 companion RPCs (Phase 2 M3, spec §10)
-- ----------------------------------------------------------------------------
-- accept_companion: the tagged friend opts the owner's pin onto THEIR OWN map
--   (a new place they own, their own defaults), links it, marks 'accepted'.
-- companion_suggestions: the tagged friend's inbox. SECURITY DEFINER so it can
--   show the label of a pin the owner tagged them on even if that pin is private
--   (the owner chose to tag them) — it only ever returns the caller's own tags.
-- Both check auth.uid() internally and are granted to `authenticated` only.
-- (get_advisors will WARN that authenticated can execute these SECURITY DEFINER
--  functions — that is intentional here.)
-- ============================================================================

create or replace function travel_pins.accept_companion(p_pc_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_place travel_pins.places%rowtype;
  v_new_id uuid;
  v_ok boolean;
begin
  -- Caller must be the companion on a still-'suggested' tag.
  select true into v_ok
  from travel_pins.place_companions
  where id = p_pc_id and companion_id = v_uid and status = 'suggested';
  if not coalesce(v_ok, false) then
    raise exception 'not authorized to accept this tag';
  end if;

  select p.* into v_place
  from travel_pins.places p
  join travel_pins.place_companions pc on pc.place_id = p.id
  where pc.id = p_pc_id;

  insert into travel_pins.places
    (user_id, label, category, lat, lng, country_code, region_code, locality, visibility)
  values
    (v_uid, v_place.label, 'visited', v_place.lat, v_place.lng,
     v_place.country_code, v_place.region_code, v_place.locality, 'friends')
  returning id into v_new_id;

  update travel_pins.place_companions
  set status = 'accepted', mirrored_place_id = v_new_id
  where id = p_pc_id;

  return v_new_id;
end;
$$;

grant execute on function travel_pins.accept_companion(uuid) to authenticated;

create or replace function travel_pins.companion_suggestions()
returns table (pc_id uuid, owner_username text, label text, visited_on date)
language sql
security definer
set search_path = ''
as $$
  select pc.id, ow.username, p.label, p.visited_on
  from travel_pins.place_companions pc
  join travel_pins.places p on p.id = pc.place_id
  join travel_pins.profiles ow on ow.id = pc.owner_id
  where pc.companion_id = auth.uid() and pc.status = 'suggested'
  order by pc.created_at desc;
$$;

grant execute on function travel_pins.companion_suggestions() to authenticated;
