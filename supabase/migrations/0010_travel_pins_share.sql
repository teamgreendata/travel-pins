-- ============================================================================
-- Travel Pins — 0010 public share RPC (Phase 2 M5, spec §6 & §11)
-- ----------------------------------------------------------------------------
-- The ONLY anonymous read path in the app. SECURITY DEFINER + granted to anon so
-- an unauthenticated visitor can render a share, while RLS stays strict for the
-- authenticated API. It returns ONLY:
--   * the owner's `public` pins (never private/friends),
--   * home pins ONLY when the share has show_homes = true, and even then with
--     coordinates fuzzed to ~1 km (rounded to 2 decimals) — never a precise home.
-- Returns null for an unknown/inactive slug.
-- (get_advisors will WARN that anon can execute this SECURITY DEFINER function —
--  that is the intended public read path.)
-- ============================================================================

create or replace function travel_pins.get_shared_map(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select user_id, show_homes
    from travel_pins.shares
    where slug = p_slug and is_active = true
    limit 1
  )
  select case
    when not exists (select 1 from s) then null
    else jsonb_build_object(
      'owner', (select pr.username from travel_pins.profiles pr, s where pr.id = s.user_id),
      'pins', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'label', p.label,
          'category', p.category,
          -- home pins fuzzed to ~1km; non-home public pins exact
          'lat', case when p.is_home then round(p.lat::numeric, 2) else p.lat end,
          'lng', case when p.is_home then round(p.lng::numeric, 2) else p.lng end,
          'country_code', p.country_code,
          'region_code', p.region_code,
          'visited_on', p.visited_on,
          'is_home', p.is_home
        ))
        from travel_pins.places p, s
        where p.user_id = s.user_id
          and p.visibility = 'public'
          and (p.is_home = false or s.show_homes = true)
      ), '[]'::jsonb)
    )
  end;
$$;

grant execute on function travel_pins.get_shared_map(text) to anon, authenticated;
