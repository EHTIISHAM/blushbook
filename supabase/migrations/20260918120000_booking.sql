-- Public booking: slot generation, booking creation, and rate limiting.
--
-- Visitors have no privileges on any table here. Everything goes through
-- security-definer functions, so the database decides what is bookable rather
-- than trusting whatever the browser posts.

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
-- Hashed in the app before it ever reaches here, so this table holds no raw
-- addresses. Rows are pruned as they are written.

create table public.booking_attempts (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index booking_attempts_lookup
  on public.booking_attempts (ip_hash, created_at desc);

create index booking_attempts_profile_lookup
  on public.booking_attempts (profile_id, ip_hash, created_at desc);

alter table public.booking_attempts enable row level security;

-- No policies and no grants: only the security-definer functions below reach
-- this table. A client-side role cannot read or write it at all.
revoke all on public.booking_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Is a slot inside her working hours, on a day she has not blocked?
-- ---------------------------------------------------------------------------
-- Hours are stored as minutes-from-midnight in her own timezone, so the
-- comparison has to happen in that timezone. Doing it here means the app can
-- never disagree with the database about what is bookable.

create or replace function public.slot_within_hours(
  p_profile_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes int
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_local    timestamp;
  v_dow      int;
  v_minutes  int;
begin
  select timezone into v_timezone from public.profiles where id = p_profile_id;
  if v_timezone is null then
    return false;
  end if;

  -- timestamptz -> the wall-clock time she would read off her own phone.
  v_local := p_starts_at at time zone v_timezone;
  v_dow := extract(dow from v_local)::int;
  v_minutes := extract(hour from v_local)::int * 60
             + extract(minute from v_local)::int;

  if exists (
    select 1
    from public.blocked_dates b
    where b.profile_id = p_profile_id
      and b.blocked_on = v_local::date
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.availability a
    where a.profile_id = p_profile_id
      and a.weekday = v_dow
      and a.start_minute <= v_minutes
      and a.end_minute >= v_minutes + p_duration_minutes
  );
end;
$$;

revoke execute on function public.slot_within_hours(uuid, timestamptz, int) from public;

-- ---------------------------------------------------------------------------
-- Open slots for one service
-- ---------------------------------------------------------------------------

create or replace function public.get_available_slots(
  p_slug text,
  p_service_id uuid,
  p_from date,
  p_days int
)
returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_service public.services%rowtype;
  v_step    int := 15;   -- offer slots on a quarter-hour grid
  v_lead    interval := interval '2 hours';
  v_days    int;
begin
  select * into v_profile from public.profiles where slug = p_slug;
  if not found or not public.is_page_live(v_profile.id) then
    return;
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
    and profile_id = v_profile.id
    and is_active;
  if not found then
    return;
  end if;

  -- Keep the window bounded; an open-ended range would let one request scan
  -- an unbounded number of days.
  v_days := least(greatest(coalesce(p_days, 14), 1), 60);

  return query
  with days as (
    select (p_from + offset_days)::date as slot_day
    from generate_series(0, v_days - 1) as offset_days
  ),
  open_windows as (
    select d.slot_day, a.start_minute, a.end_minute
    from days d
    join public.availability a
      on a.profile_id = v_profile.id
     and a.weekday = extract(dow from d.slot_day)::int
    where not exists (
      select 1
      from public.blocked_dates b
      where b.profile_id = v_profile.id
        and b.blocked_on = d.slot_day
    )
  ),
  candidates as (
    select
      (w.slot_day + make_interval(mins => minute_offset))
        at time zone v_profile.timezone as starts_at
    from open_windows w
    cross join lateral generate_series(
      w.start_minute,
      w.end_minute - v_service.duration_minutes,
      v_step
    ) as minute_offset
  )
  select c.starts_at
  from candidates c
  where c.starts_at > now() + v_lead
    and not exists (
      select 1
      from public.bookings bk
      where bk.profile_id = v_profile.id
        and bk.status in ('booked', 'completed')
        and tstzrange(bk.starts_at, bk.ends_at, '[)') && tstzrange(
              c.starts_at,
              c.starts_at + make_interval(mins => v_service.duration_minutes),
              '[)'
            )
    )
  order by c.starts_at;
end;
$$;

revoke execute on function public.get_available_slots(text, uuid, date, int) from public;
grant execute on function public.get_available_slots(text, uuid, date, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Does this booking link exist, and is it taking bookings?
-- ---------------------------------------------------------------------------
-- The public read policy hides a paused page completely, which would make it
-- indistinguishable from a typo. A client who was sent a real link deserves
-- "bookings are paused" rather than a 404. Only the state is exposed, never
-- the reason or any of her data.

create or replace function public.page_status(p_slug text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not exists (select 1 from public.profiles where slug = p_slug)
      then 'missing'
    when (select public.is_page_live(id) from public.profiles where slug = p_slug)
      then 'live'
    else 'paused'
  end;
$$;

revoke execute on function public.page_status(text) from public;
grant execute on function public.page_status(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a booking
-- ---------------------------------------------------------------------------
-- Everything the browser sends is re-checked here. The exclusion constraint on
-- bookings is still the final word on double booking; this only turns the race
-- it catches into a message a client can act on.

create or replace function public.create_booking(
  p_slug          text,
  p_service_id    uuid,
  p_starts_at     timestamptz,
  p_client_name   text,
  p_client_contact text,
  p_contact_kind  public.contact_kind,
  p_ip_hash       text
)
returns table (
  booking_id    uuid,
  business_name text,
  service_name  text,
  starts_at     timestamptz,
  deposit_cents int,
  currency      text,
  timezone      text,
  deposit_link  text,
  no_show_policy text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_service public.services%rowtype;
  v_ends_at timestamptz;
  v_booking public.bookings%rowtype;
  v_recent  int;
begin
  if p_ip_hash is null or length(p_ip_hash) < 16 then
    raise exception 'bad request' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where slug = p_slug;
  if not found or not public.is_page_live(v_profile.id) then
    raise exception 'This booking page is not taking bookings right now.'
      using errcode = 'P0002';
  end if;

  -- Housekeeping, cheap and bounded.
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

  select * into v_service
  from public.services
  where id = p_service_id
    and profile_id = v_profile.id
    and is_active;
  if not found then
    raise exception 'That service is no longer available.'
      using errcode = 'P0002';
  end if;

  if p_starts_at <= now() then
    raise exception 'That time has already passed.' using errcode = 'P0001';
  end if;

  if not public.slot_within_hours(
       v_profile.id, p_starts_at, v_service.duration_minutes
     ) then
    raise exception 'That time is outside her working hours.'
      using errcode = 'P0001';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  begin
    insert into public.bookings (
      profile_id, service_id, client_name, client_contact, contact_kind,
      starts_at, ends_at, service_name, price_cents, deposit_cents
    )
    values (
      v_profile.id, v_service.id, btrim(p_client_name), btrim(p_client_contact),
      p_contact_kind, p_starts_at, v_ends_at, v_service.name,
      v_service.price_cents, v_service.deposit_cents
    )
    returning * into v_booking;
  exception when exclusion_violation then
    -- Someone took it between the page loading and this insert.
    raise exception 'Sorry, that slot was just booked. Please pick another.'
      using errcode = 'P0001';
  end;

  -- Her first booking starts the clock on activating the plan.
  update public.profiles
  set first_booking_at = now()
  where id = v_profile.id
    and first_booking_at is null;

  return query
  select
    v_booking.id,
    v_profile.business_name,
    v_booking.service_name,
    v_booking.starts_at,
    v_booking.deposit_cents,
    v_profile.currency,
    v_profile.timezone,
    v_profile.deposit_link,
    v_profile.no_show_policy;
end;
$$;

revoke execute on function public.create_booking(
  text, uuid, timestamptz, text, text, public.contact_kind, text
) from public;
grant execute on function public.create_booking(
  text, uuid, timestamptz, text, text, public.contact_kind, text
) to anon, authenticated;
