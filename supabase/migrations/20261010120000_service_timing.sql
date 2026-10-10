-- Service timing rulebook
--
-- Brings in the parts of the BooknBloom service timing rulebook that need the
-- database:
--
--   * profiles.business_sector picks which rulebook rows a rate card is
--     matched against.
--   * services get a buffer (time kept free after the service) and a slot
--     step (how far apart customer start times are offered).
--   * services.timing_review_note marks a suggested timing the business has
--     not checked yet. It is shown in the dashboard, never to clients.
--   * Customer slots now need room for the service plus its buffer, inside
--     working hours and clear of other bookings and their buffers.
--
-- A visit of several services still runs back to back. Its buffer is the
-- largest buffer among its services and sits after the last one.
--
-- Existing services get a 0 minute buffer and a 15 minute step, so nothing
-- changes for them until the business sets one.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- profiles.business_sector
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists business_sector text;

alter table public.profiles drop constraint if exists profiles_business_sector_known;
alter table public.profiles
  add constraint profiles_business_sector_known check (
    business_sector is null or business_sector in (
      'salon', 'clinic', 'dentist', 'tutor', 'coach', 'consultant', 'pet', 'local'
    )
  );

-- ---------------------------------------------------------------------------
-- services: buffer, slot step, review flag
-- ---------------------------------------------------------------------------

alter table public.services
  add column if not exists buffer_minutes    int not null default 0,
  add column if not exists slot_step_minutes int not null default 15,
  add column if not exists timing_review_note text;

alter table public.services drop constraint if exists services_buffer_range;
alter table public.services
  add constraint services_buffer_range check (buffer_minutes between 0 and 240);

alter table public.services drop constraint if exists services_slot_step_known;
alter table public.services
  add constraint services_slot_step_known check (slot_step_minutes in (5, 10, 15, 20, 30, 60));

alter table public.services drop constraint if exists services_review_note_len;
alter table public.services
  add constraint services_review_note_len check (
    timing_review_note is null or length(timing_review_note) <= 300
  );

-- ---------------------------------------------------------------------------
-- bookings: the buffer that follows them
-- ---------------------------------------------------------------------------
-- blocked_until = ends_at + buffer_minutes. It is a plain column kept by a
-- trigger, because an exclusion constraint can only use immutable
-- expressions and timestamptz + interval isn't one.

alter table public.bookings
  add column if not exists buffer_minutes int not null default 0,
  add column if not exists blocked_until  timestamptz;

alter table public.bookings drop constraint if exists bookings_buffer_range;
alter table public.bookings
  add constraint bookings_buffer_range check (buffer_minutes between 0 and 240);

create or replace function public.bookings_set_blocked_until()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.blocked_until := new.ends_at + make_interval(mins => new.buffer_minutes);
  return new;
end;
$$;

drop trigger if exists bookings_set_blocked_until on public.bookings;
create trigger bookings_set_blocked_until
  before insert or update of ends_at, buffer_minutes, blocked_until on public.bookings
  for each row execute function public.bookings_set_blocked_until();

update public.bookings
set blocked_until = ends_at + make_interval(mins => buffer_minutes)
where blocked_until is null;

alter table public.bookings alter column blocked_until set not null;

-- Double booking now counts the buffer. Dropped and re-added, so a re-run
-- always ends on this version.
alter table public.bookings drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status in ('booked', 'completed'));

-- ---------------------------------------------------------------------------
-- Open start times for a visit
-- ---------------------------------------------------------------------------
-- As before, plus: the visit needs room for its buffer, and start times sit
-- on the finest slot step among its services.

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
  v_buffer  int;
  v_span    int;
  v_step    int;
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

  select array_agg(v.id), sum(v.duration_minutes), max(v.buffer_minutes),
         min(v.slot_step_minutes)
  into v_ids, v_total, v_buffer, v_step
  from public.visit_services(v_profile.id, p_service_ids) v;

  -- A service that has gone away means the client's list is stale.
  if v_ids is null
     or cardinality(v_ids) <> (select count(distinct x) from unnest(p_service_ids) x) then
    return;
  end if;

  v_span := v_total + coalesce(v_buffer, 0);
  v_step := coalesce(v_step, 15);
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
      w.end_minute - v_span,
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
        and tstzrange(bk.starts_at, bk.blocked_until, '[)') && tstzrange(
              c.starts_at,
              c.starts_at + make_interval(mins => v_span),
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
-- As before, plus: working hours must cover the buffer too, and the last row
-- of the visit carries the buffer so the exclusion constraint keeps it free.

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
  v_buffer    int;
  v_count     int;
  v_index     int;
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

  select array_agg(v.id), sum(v.duration_minutes), max(v.buffer_minutes)
  into v_ids, v_total, v_buffer
  from public.visit_services(v_profile.id, p_service_ids) v;

  if v_ids is null
     or cardinality(v_ids) <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'One of those services is no longer available. Please refresh and pick again.'
      using errcode = 'P0002';
  end if;

  v_buffer := coalesce(v_buffer, 0);
  v_count := cardinality(v_ids);

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
      -- over the length of the whole visit and its buffer.
      and public.staff_slot_ok(s.id, null, p_starts_at, v_total + v_buffer)
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
      v_index := 0;

      for v_service in
        select * from public.visit_services(v_profile.id, v_ids)
      loop
        v_index := v_index + 1;

        insert into public.bookings (
          profile_id, staff_id, service_id, client_name, client_contact,
          contact_kind, client_email, starts_at, ends_at, buffer_minutes,
          service_name, price_cents, deposit_cents
        )
        values (
          v_profile.id, v_member.id, v_service.id, btrim(p_client_name),
          btrim(p_client_contact), p_contact_kind,
          nullif(lower(btrim(p_client_email)), ''), v_cursor,
          v_cursor + make_interval(mins => v_service.duration_minutes),
          case when v_index = v_count then v_buffer else 0 end,
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
