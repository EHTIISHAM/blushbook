-- Booking several services in one visit
--
-- A client can now tick more than one service and pick a single start time.
-- The services run back to back with one staff member, in menu order, and
-- each is stored as its own booking row exactly as before. Analytics,
-- follow-ups and the dashboard need no changes: a two-service visit is simply
-- two consecutive bookings for the same client.
--
-- New functions sit beside the single-service ones rather than replacing
-- them, so the booking page keeps working in the gap between running this
-- migration and deploying the new app. The old two can be dropped later.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- The services in a visit, validated and in menu order
-- ---------------------------------------------------------------------------
-- Only active services of this business count; anything else in the list is
-- dropped, and the callers check that nothing was.

create or replace function public.visit_services(p_profile_id uuid, p_service_ids uuid[])
returns setof public.services
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sv.*
  from public.services sv
  where sv.profile_id = p_profile_id
    and sv.is_active
    and sv.id = any (p_service_ids)
  order by sv.sort_order, sv.created_at;
$$;

revoke execute on function public.visit_services(uuid, uuid[]) from public;

-- Does this staff member do every service in the list?
create or replace function public.staff_does_services(p_staff_id uuid, p_service_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(bool_and(public.staff_does_service(p_staff_id, sid)), false)
  from unnest(p_service_ids) as sid;
$$;

revoke execute on function public.staff_does_services(uuid, uuid[]) from public;

-- ---------------------------------------------------------------------------
-- Open start times for a visit
-- ---------------------------------------------------------------------------
-- A start time is offered when one staff member who does every chosen service
-- is inside their hours, and free, for the whole visit.

create or replace function public.get_visit_slots(
  p_slug        text,
  p_service_ids uuid[],
  p_from        date,
  p_days        int,
  p_staff_id    uuid default null
)
returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_ids     uuid[];
  v_total   int;
  v_step    int := 15;   -- offer slots on a quarter-hour grid
  v_lead    interval := interval '2 hours';
  v_days    int;
begin
  select * into v_profile from public.profiles where slug = p_slug;

  if not found or not public.is_page_live(v_profile.id) then
    return;
  end if;

  if p_service_ids is null
     or cardinality(p_service_ids) = 0
     or cardinality(p_service_ids) > 6 then
    return;
  end if;

  select array_agg(v.id), sum(v.duration_minutes)
  into v_ids, v_total
  from public.visit_services(v_profile.id, p_service_ids) v;

  -- A service that has gone away means the client's list is stale.
  if v_ids is null
     or cardinality(v_ids) <> (select count(distinct x) from unnest(p_service_ids) x) then
    return;
  end if;

  v_days := least(greatest(coalesce(p_days, 14), 1), 60);

  return query
  with days as (
    select (p_from + offset_days)::date as slot_day
    from generate_series(0, v_days - 1) as offset_days
  ),
  members as (
    select s.id
    from public.staff s
    where s.profile_id = v_profile.id
      and s.is_active
      and (p_staff_id is null or s.id = p_staff_id)
      and public.staff_does_services(s.id, v_ids)
  ),
  windows as (
    select m.id as staff_id, d.slot_day, w.start_minute, w.end_minute
    from members m
    cross join days d
    cross join lateral public.staff_windows(m.id, d.slot_day) w
  ),
  candidates as (
    select
      w.staff_id,
      (w.slot_day + make_interval(mins => minute_offset))
        at time zone v_profile.timezone as starts_at
    from windows w
    cross join lateral generate_series(
      w.start_minute,
      w.end_minute - v_total,
      v_step
    ) as minute_offset
  )
  select distinct c.starts_at
  from candidates c
  where c.starts_at > now() + v_lead
    and not exists (
      select 1
      from public.bookings bk
      where bk.staff_id = c.staff_id
        and bk.status in ('booked', 'completed')
        and tstzrange(bk.starts_at, bk.ends_at, '[)') && tstzrange(
              c.starts_at,
              c.starts_at + make_interval(mins => v_total),
              '[)'
            )
    )
  order by c.starts_at;
end;
$$;

revoke execute on function public.get_visit_slots(text, uuid[], date, int, uuid) from public;
grant execute on function public.get_visit_slots(text, uuid[], date, int, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Book a visit
-- ---------------------------------------------------------------------------
-- Same rules as create_booking: rate limits, "anyone available" goes to
-- whoever has the fewest bookings that day, and the exclusion constraint has
-- the last word. Every row of the visit goes to one staff member. If any of
-- them clashes, that person's whole attempt rolls back and the next is tried.

create or replace function public.create_visit(
  p_slug           text,
  p_service_ids    uuid[],
  p_starts_at      timestamptz,
  p_client_name    text,
  p_client_contact text,
  p_contact_kind   public.contact_kind,
  p_ip_hash        text,
  p_client_email   text default null,
  p_staff_id       uuid default null
)
returns table (
  booking_id     uuid,
  business_name  text,
  service_name   text,
  staff_name     text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  price_cents    int,
  deposit_cents  int,
  currency       text,
  timezone       text,
  deposit_link   text,
  no_show_policy text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile   public.profiles%rowtype;
  v_member    public.staff%rowtype;
  v_service   public.services%rowtype;
  v_ids       uuid[];
  v_total     int;
  v_cursor    timestamptz;
  v_local_day date;
  v_recent    int;
  v_fits      boolean := false;
  v_booked    boolean := false;
  v_rows      uuid[] := '{}';
  v_id        uuid;
begin
  if p_ip_hash is null or length(p_ip_hash) < 16 then
    raise exception 'bad request' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where slug = p_slug;

  if not found or not public.is_page_live(v_profile.id) then
    raise exception 'This booking page is not taking bookings right now.'
      using errcode = 'P0002';
  end if;

  -- Rate limiting, as in create_booking: one attempt per visit, however many
  -- services are in it.
  delete from public.booking_attempts where created_at < now() - interval '2 days';

  select count(*) into v_recent
  from public.booking_attempts
  where ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';

  if v_recent >= 15 then
    raise exception 'Too many attempts. Try again in an hour.'
      using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.booking_attempts
  where ip_hash = p_ip_hash
    and profile_id = v_profile.id
    and created_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'Too many bookings from this device. Try again in an hour.'
      using errcode = 'P0001';
  end if;

  insert into public.booking_attempts (profile_id, ip_hash)
  values (v_profile.id, p_ip_hash);

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'Pick a service.' using errcode = 'P0001';
  end if;

  if cardinality(p_service_ids) > 6 then
    raise exception 'Please book up to 6 services at a time.'
      using errcode = 'P0001';
  end if;

  select array_agg(v.id), sum(v.duration_minutes)
  into v_ids, v_total
  from public.visit_services(v_profile.id, p_service_ids) v;

  if v_ids is null
     or cardinality(v_ids) <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'One of those services is no longer available. Please refresh and pick again.'
      using errcode = 'P0002';
  end if;

  if p_starts_at <= now() then
    raise exception 'That time has already passed.' using errcode = 'P0001';
  end if;

  v_local_day := (p_starts_at at time zone v_profile.timezone)::date;

  for v_member in
    select s.*
    from public.staff s
    where s.profile_id = v_profile.id
      and s.is_active
      and (p_staff_id is null or s.id = p_staff_id)
      and public.staff_does_services(s.id, v_ids)
      -- No service here: services were checked above, this is hours only,
      -- over the length of the whole visit.
      and public.staff_slot_ok(s.id, null, p_starts_at, v_total)
    order by
      (
        select count(*)
        from public.bookings b
        where b.staff_id = s.id
          and b.status in ('booked', 'completed')
          and (b.starts_at at time zone v_profile.timezone)::date = v_local_day
      ),
      s.sort_order,
      s.created_at
  loop
    v_fits := true;

    begin
      v_cursor := p_starts_at;
      v_rows := '{}';

      for v_service in
        select * from public.visit_services(v_profile.id, v_ids)
      loop
        insert into public.bookings (
          profile_id, staff_id, service_id, client_name, client_contact,
          contact_kind, client_email, starts_at, ends_at, service_name,
          price_cents, deposit_cents
        )
        values (
          v_profile.id, v_member.id, v_service.id, btrim(p_client_name),
          btrim(p_client_contact), p_contact_kind,
          nullif(lower(btrim(p_client_email)), ''), v_cursor,
          v_cursor + make_interval(mins => v_service.duration_minutes),
          v_service.name, v_service.price_cents, v_service.deposit_cents
        )
        returning id into v_id;

        v_rows := v_rows || v_id;
        v_cursor := v_cursor + make_interval(mins => v_service.duration_minutes);
      end loop;

      v_booked := true;
      exit;
    exception when exclusion_violation then
      -- Taken somewhere in the visit. Leaving the block undoes this
      -- person's rows; try the next one.
      null;
    end;
  end loop;

  if not v_fits then
    raise exception 'That time is outside working hours.'
      using errcode = 'P0001';
  end if;

  if not v_booked then
    raise exception 'Sorry, that time was just booked. Please pick another.'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set first_booking_at = now()
  where id = v_profile.id
    and first_booking_at is null;

  return query
  select
    b.id,
    v_profile.business_name,
    b.service_name,
    v_member.name,
    b.starts_at,
    b.ends_at,
    b.price_cents,
    b.deposit_cents,
    v_profile.currency,
    v_profile.timezone,
    v_profile.deposit_link,
    v_profile.no_show_policy
  from public.bookings b
  where b.id = any (v_rows)
  order by b.starts_at;
end;
$$;

revoke execute on function public.create_visit(
  text, uuid[], timestamptz, text, text, public.contact_kind, text, text, uuid
) from public;

grant execute on function public.create_visit(
  text, uuid[], timestamptz, text, text, public.contact_kind, text, text, uuid
) to anon, authenticated;
