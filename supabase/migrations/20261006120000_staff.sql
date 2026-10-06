-- Staff
--
-- A business can now have several people taking bookings. Each staff member
-- has their own hours, days off and list of services, and double booking is
-- prevented per person rather than across the whole business.
--
-- Two switches keep the simple case simple. A staff member can follow the
-- business's hours (the Hours tab) instead of having their own, and can do
-- every service instead of a picked list. Both start switched on, so a solo
-- business keeps working exactly as before with one staff member it never
-- has to look at.
--
-- When a staff member can be booked:
--   business open that weekday (availability)
--   AND the business isn't closed that day (blocked_dates)
--   AND the staff member isn't off that day (staff_time_off)
--   AND inside their own hours (staff_hours), unless they follow the business
--   AND they do the service.
-- Staff hours never stretch past business hours: the two are intersected.
--
-- Safe to run more than once, and safe to re-run after a run that stopped
-- part way: every step skips what is already in place.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Children reference (id, profile_id) rather than id alone, so a row can
-- never point at another business's staff member or service, whatever the
-- caller sends.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_id_profile_unique'
  ) then
    alter table public.services
      add constraint services_id_profile_unique unique (id, profile_id);
  end if;
end;
$$;

-- create_booking below records client_email. It arrived in an earlier
-- migration; make sure it is here even if that one was skipped.
alter table public.bookings add column if not exists client_email text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_client_email_format'
  ) then
    alter table public.bookings
      add constraint bookings_client_email_format check (
        client_email is null
        or (length(client_email) <= 254 and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
      );
  end if;
end;
$$;

create table if not exists public.staff (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles (id) on delete cascade,
  name                  text not null,
  swatch                text not null default '#9E5A60',
  is_active             boolean not null default true,
  hours_follow_business boolean not null default true,
  all_services          boolean not null default true,
  sort_order            int  not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint staff_name_not_blank check (length(btrim(name)) between 1 and 60),
  constraint staff_swatch_hex     check (swatch ~ '^#[0-9A-Fa-f]{6}$'),
  constraint staff_id_profile_unique unique (id, profile_id)
);

create index if not exists staff_profile_sort_idx on public.staff (profile_id, sort_order, created_at);

drop trigger if exists staff_touch_updated_at on public.staff;
create trigger staff_touch_updated_at
  before update on public.staff
  for each row execute function public.touch_updated_at();

-- Weekly hours, used only when hours_follow_business is off. Same shape as
-- availability: minutes from midnight in the business's timezone.
create table if not exists public.staff_hours (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null,
  profile_id   uuid not null,
  weekday      smallint not null,
  start_minute int not null,
  end_minute   int not null,

  foreign key (staff_id, profile_id)
    references public.staff (id, profile_id) on delete cascade,

  constraint staff_hours_weekday_range check (weekday between 0 and 6),
  constraint staff_hours_start_range   check (start_minute >= 0 and start_minute < 1440),
  constraint staff_hours_end_range     check (end_minute > 0 and end_minute <= 1440),
  constraint staff_hours_order         check (end_minute > start_minute),
  constraint staff_hours_no_overlap exclude using gist (
    staff_id with =,
    weekday  with =,
    int4range(start_minute, end_minute) with &&
  )
);

create index if not exists staff_hours_staff_idx on public.staff_hours (staff_id, weekday);

create table if not exists public.staff_time_off (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null,
  profile_id uuid not null,
  off_on     date not null,
  note       text,
  created_at timestamptz not null default now(),

  foreign key (staff_id, profile_id)
    references public.staff (id, profile_id) on delete cascade,

  constraint staff_time_off_unique   unique (staff_id, off_on),
  constraint staff_time_off_note_len check (note is null or length(note) <= 120)
);

create index if not exists staff_time_off_profile_idx on public.staff_time_off (profile_id, off_on);

-- Which services a staff member does, used only when all_services is off.
create table if not exists public.staff_services (
  staff_id   uuid not null,
  service_id uuid not null,
  profile_id uuid not null,

  primary key (staff_id, service_id),
  foreign key (staff_id, profile_id)
    references public.staff (id, profile_id) on delete cascade,
  foreign key (service_id, profile_id)
    references public.services (id, profile_id) on delete cascade
);

create index if not exists staff_services_service_idx on public.staff_services (service_id);

-- ---------------------------------------------------------------------------
-- Every business starts with one staff member
-- ---------------------------------------------------------------------------
-- Named "Owner" until renamed. Clients only ever see staff names once a
-- business has two or more, and the Staff tab asks for a real name first.

create or replace function public.profiles_create_owner_staff()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.staff (profile_id, name) values (new.id, 'Owner');
  return new;
end;
$$;

drop trigger if exists profiles_create_owner_staff on public.profiles;
create trigger profiles_create_owner_staff
  after insert on public.profiles
  for each row execute function public.profiles_create_owner_staff();

insert into public.staff (profile_id, name)
select pr.id, 'Owner'
from public.profiles pr
where not exists (select 1 from public.staff s where s.profile_id = pr.id);

-- ---------------------------------------------------------------------------
-- Bookings belong to a staff member
-- ---------------------------------------------------------------------------

alter table public.bookings add column if not exists staff_id uuid;

-- Every business has exactly one staff member at this point, so this hands
-- all existing bookings to them.
update public.bookings b
set staff_id = s.id
from public.staff s
where s.profile_id = b.profile_id
  and b.staff_id is null;

alter table public.bookings alter column staff_id set not null;

-- No cascade: a staff member with bookings is switched off, never deleted,
-- so the history keeps who did the work.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_staff_fk') then
    alter table public.bookings
      add constraint bookings_staff_fk
        foreign key (staff_id, profile_id) references public.staff (id, profile_id);
  end if;
end;
$$;

-- Double booking is now per person: two staff can each see a client at 2pm.
-- Dropped and re-added, so a re-run always ends on the per-person version.
alter table public.bookings drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('booked', 'completed'));

create index if not exists bookings_staff_start_idx on public.bookings (staff_id, starts_at);

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------
-- The owner manages everything. Visitors get nothing on these tables: the
-- booking page reads staff through get_booking_staff below.

alter table public.staff          enable row level security;
alter table public.staff_hours    enable row level security;
alter table public.staff_time_off enable row level security;
alter table public.staff_services enable row level security;

drop policy if exists staff_owner_all on public.staff;
create policy staff_owner_all on public.staff
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists staff_hours_owner_all on public.staff_hours;
create policy staff_hours_owner_all on public.staff_hours
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists staff_time_off_owner_all on public.staff_time_off;
create policy staff_time_off_owner_all on public.staff_time_off
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists staff_services_owner_all on public.staff_services;
create policy staff_services_owner_all on public.staff_services
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke all on public.staff          from anon, authenticated;
revoke all on public.staff_hours    from anon, authenticated;
revoke all on public.staff_time_off from anon, authenticated;
revoke all on public.staff_services from anon, authenticated;

grant select, insert, update, delete on public.staff          to authenticated;
grant select, insert, update, delete on public.staff_hours    to authenticated;
grant select, insert, update, delete on public.staff_time_off to authenticated;
grant select, insert, update, delete on public.staff_services to authenticated;

-- ---------------------------------------------------------------------------
-- When is a staff member bookable?
-- ---------------------------------------------------------------------------

-- Their open windows on one calendar day, in minutes from midnight. Nothing
-- on a day the business is closed or they are off.
create or replace function public.staff_windows(p_staff_id uuid, p_day date)
returns table (start_minute int, end_minute int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with member as (
    select s.id, s.profile_id, s.hours_follow_business
    from public.staff s
    where s.id = p_staff_id
      and s.is_active
  ),
  business as (
    select a.start_minute, a.end_minute
    from public.availability a
    join member m on m.profile_id = a.profile_id
    where a.weekday = extract(dow from p_day)::int
      and not exists (
        select 1 from public.blocked_dates b
        where b.profile_id = m.profile_id and b.blocked_on = p_day
      )
      and not exists (
        select 1 from public.staff_time_off o
        where o.staff_id = m.id and o.off_on = p_day
      )
  ),
  own as (
    select h.start_minute, h.end_minute
    from public.staff_hours h
    join member m on m.id = h.staff_id
    where h.weekday = extract(dow from p_day)::int
      and not m.hours_follow_business
  )
  select b.start_minute, b.end_minute
  from business b
  where (select hours_follow_business from member)
  union all
  select greatest(b.start_minute, o.start_minute), least(b.end_minute, o.end_minute)
  from business b
  cross join own o
  where greatest(b.start_minute, o.start_minute) < least(b.end_minute, o.end_minute);
$$;

revoke execute on function public.staff_windows(uuid, date) from public;

create or replace function public.staff_does_service(p_staff_id uuid, p_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff s
    where s.id = p_staff_id
      and (
        s.all_services
        or exists (
          select 1 from public.staff_services ss
          where ss.staff_id = s.id and ss.service_id = p_service_id
        )
      )
  );
$$;

revoke execute on function public.staff_does_service(uuid, uuid) from public;

-- Can this staff member take this service at this time? Ignores other
-- bookings; the exclusion constraint has the last word on those.
create or replace function public.staff_slot_ok(
  p_staff_id uuid,
  p_service_id uuid,
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
  v_minutes  int;
begin
  select pr.timezone into v_timezone
  from public.staff s
  join public.profiles pr on pr.id = s.profile_id
  where s.id = p_staff_id;

  if v_timezone is null then
    return false;
  end if;

  -- A deleted service no longer narrows anything down.
  if p_service_id is not null
     and not public.staff_does_service(p_staff_id, p_service_id) then
    return false;
  end if;

  v_local := p_starts_at at time zone v_timezone;
  v_minutes := extract(hour from v_local)::int * 60
             + extract(minute from v_local)::int;

  return exists (
    select 1
    from public.staff_windows(p_staff_id, v_local::date) w
    where w.start_minute <= v_minutes
      and w.end_minute >= v_minutes + p_duration_minutes
  );
end;
$$;

revoke execute on function public.staff_slot_ok(uuid, uuid, timestamptz, int) from public;

-- Replaced by staff_slot_ok.
drop function if exists public.slot_within_hours(uuid, timestamptz, int);

-- ---------------------------------------------------------------------------
-- Booking page: who can be booked
-- ---------------------------------------------------------------------------
-- Active staff and the active services each one does. Names and colours only.

create or replace function public.get_booking_staff(p_slug text)
returns table (staff_id uuid, name text, swatch text, service_ids uuid[])
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.name,
    s.swatch,
    coalesce(
      array(
        select sv.id
        from public.services sv
        where sv.profile_id = s.profile_id
          and sv.is_active
          and (
            s.all_services
            or exists (
              select 1 from public.staff_services ss
              where ss.staff_id = s.id and ss.service_id = sv.id
            )
          )
        order by sv.sort_order
      ),
      '{}'
    )
  from public.staff s
  join public.profiles pr on pr.id = s.profile_id
  where pr.slug = p_slug
    and s.is_active
    and public.is_page_live(pr.id)
  order by s.sort_order, s.created_at;
$$;

revoke execute on function public.get_booking_staff(text) from public;
grant execute on function public.get_booking_staff(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Open slots: for one staff member, or for anyone who does the service
-- ---------------------------------------------------------------------------

-- Every older version goes, whatever its exact argument list, so the
-- booking page can only ever reach the staff-aware one.
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_available_slots', 'create_booking')
  loop
    execute format('drop function %s', v_fn);
  end loop;
end;
$$;

create function public.get_available_slots(
  p_slug text,
  p_service_id uuid,
  p_from date,
  p_days int,
  p_staff_id uuid default null
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
  members as (
    select s.id
    from public.staff s
    where s.profile_id = v_profile.id
      and s.is_active
      and (p_staff_id is null or s.id = p_staff_id)
      and public.staff_does_service(s.id, v_service.id)
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
      w.end_minute - v_service.duration_minutes,
      v_step
    ) as minute_offset
  )
  -- A time is open if at least one of the staff in play is free for it.
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
              c.starts_at + make_interval(mins => v_service.duration_minutes),
              '[)'
            )
    )
  order by c.starts_at;
end;
$$;

revoke execute on function public.get_available_slots(text, uuid, date, int, uuid) from public;
grant execute on function public.get_available_slots(text, uuid, date, int, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a booking, with a chosen staff member or "anyone available"
-- ---------------------------------------------------------------------------
-- With "anyone", the client goes to whoever has the fewest bookings that day,
-- so work is shared out. Each candidate is tried in turn: if another client
-- takes that person in the same instant, the exclusion constraint refuses
-- the insert and the next free person gets it instead.

create function public.create_booking(
  p_slug           text,
  p_service_id     uuid,
  p_starts_at      timestamptz,
  p_client_name    text,
  p_client_contact text,
  p_contact_kind   public.contact_kind,
  p_ip_hash        text,
  p_client_email   text default null,
  p_staff_id       uuid default null
)
returns table (
  booking_id    uuid,
  business_name text,
  service_name  text,
  staff_name    text,
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
  v_profile   public.profiles%rowtype;
  v_service   public.services%rowtype;
  v_member    public.staff%rowtype;
  v_ends_at   timestamptz;
  v_booking   public.bookings%rowtype;
  v_recent    int;
  v_local_day date;
  v_fits      boolean := false;
begin
  if p_ip_hash is null or length(p_ip_hash) < 16 then
    raise exception 'bad request' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where slug = p_slug;

  if not found or not public.is_page_live(v_profile.id) then
    raise exception 'This booking page is not taking bookings right now.'
      using errcode = 'P0002';
  end if;

  -- Rate limiting, unchanged: per device overall, and per device per page.
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

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_day := (p_starts_at at time zone v_profile.timezone)::date;

  for v_member in
    select s.*
    from public.staff s
    where s.profile_id = v_profile.id
      and s.is_active
      and (p_staff_id is null or s.id = p_staff_id)
      and public.staff_slot_ok(s.id, v_service.id, p_starts_at, v_service.duration_minutes)
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
      insert into public.bookings (
        profile_id, staff_id, service_id, client_name, client_contact,
        contact_kind, client_email, starts_at, ends_at, service_name,
        price_cents, deposit_cents
      )
      values (
        v_profile.id, v_member.id, v_service.id, btrim(p_client_name),
        btrim(p_client_contact), p_contact_kind,
        nullif(lower(btrim(p_client_email)), ''), p_starts_at, v_ends_at,
        v_service.name, v_service.price_cents, v_service.deposit_cents
      )
      returning * into v_booking;

      exit;
    exception when exclusion_violation then
      -- This person is taken at that time; try the next one.
      null;
    end;
  end loop;

  if not v_fits then
    raise exception 'That time is outside working hours.'
      using errcode = 'P0001';
  end if;

  if v_booking.id is null then
    raise exception 'Sorry, that slot was just booked. Please pick another.'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set first_booking_at = now()
  where id = v_profile.id
    and first_booking_at is null;

  return query
  select
    v_booking.id,
    v_profile.business_name,
    v_booking.service_name,
    v_member.name,
    v_booking.starts_at,
    v_booking.deposit_cents,
    v_profile.currency,
    v_profile.timezone,
    v_profile.deposit_link,
    v_profile.no_show_policy;
end;
$$;

revoke execute on function public.create_booking(
  text, uuid, timestamptz, text, text, public.contact_kind, text, text, uuid
) from public;

grant execute on function public.create_booking(
  text, uuid, timestamptz, text, text, public.contact_kind, text, text, uuid
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard: save a staff member in one go
-- ---------------------------------------------------------------------------
-- Details, hours and services are written together so a rejected window
-- can't leave a half-saved person. Runs as the caller, so RLS applies.

create or replace function public.save_staff(
  p_staff_id              uuid,
  p_name                  text,
  p_swatch                text,
  p_is_active             boolean,
  p_hours_follow_business boolean,
  p_windows               jsonb,
  p_all_services          boolean,
  p_service_ids           uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid := p_staff_id;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not p_is_active and not exists (
    select 1 from public.staff
    where profile_id = v_uid
      and is_active
      and id is distinct from p_staff_id
  ) then
    raise exception 'Keep at least one staff member taking bookings.'
      using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.staff (
      profile_id, name, swatch, is_active, hours_follow_business,
      all_services, sort_order
    )
    values (
      v_uid, btrim(p_name), p_swatch, p_is_active, p_hours_follow_business,
      p_all_services,
      coalesce((select max(sort_order) + 1 from public.staff where profile_id = v_uid), 0)
    )
    returning id into v_id;
  else
    update public.staff
    set name = btrim(p_name),
        swatch = p_swatch,
        is_active = p_is_active,
        hours_follow_business = p_hours_follow_business,
        all_services = p_all_services
    where id = v_id
      and profile_id = v_uid;

    if not found then
      raise exception 'That staff member no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.staff_hours where staff_id = v_id;

  if not p_hours_follow_business then
    insert into public.staff_hours (staff_id, profile_id, weekday, start_minute, end_minute)
    select
      v_id,
      v_uid,
      (w ->> 'weekday')::smallint,
      (w ->> 'start_minute')::int,
      (w ->> 'end_minute')::int
    from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) as w;
  end if;

  delete from public.staff_services where staff_id = v_id;

  if not p_all_services then
    -- The composite foreign key rejects any id that isn't one of her services.
    insert into public.staff_services (staff_id, service_id, profile_id)
    select distinct v_id, sid, v_uid
    from unnest(coalesce(p_service_ids, '{}')) as sid;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.save_staff(
  uuid, text, text, boolean, boolean, jsonb, boolean, uuid[]
) from public;

grant execute on function public.save_staff(
  uuid, text, text, boolean, boolean, jsonb, boolean, uuid[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard: move a booking to another staff member
-- ---------------------------------------------------------------------------

create or replace function public.reassign_booking(p_booking_id uuid, p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_member  public.staff%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id and profile_id = v_uid;

  if not found then
    raise exception 'That booking no longer exists.' using errcode = 'P0002';
  end if;

  select * into v_member
  from public.staff
  where id = p_staff_id and profile_id = v_uid and is_active;

  if not found then
    raise exception 'That staff member isn''t taking bookings.' using errcode = 'P0002';
  end if;

  if v_booking.staff_id = v_member.id then
    return;
  end if;

  if not public.staff_slot_ok(
       v_member.id,
       v_booking.service_id,
       v_booking.starts_at,
       (extract(epoch from v_booking.ends_at - v_booking.starts_at) / 60)::int
     ) then
    raise exception '% isn''t working then, or doesn''t do this service.', v_member.name
      using errcode = 'P0001';
  end if;

  begin
    update public.bookings set staff_id = v_member.id where id = v_booking.id;
  exception when exclusion_violation then
    raise exception '% already has a booking at that time.', v_member.name
      using errcode = 'P0001';
  end;
end;
$$;

revoke execute on function public.reassign_booking(uuid, uuid) from public;
grant execute on function public.reassign_booking(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard: upcoming bookings that no longer fit
-- ---------------------------------------------------------------------------
-- Changing hours, adding a day off, switching someone off or taking a
-- service away never cancels a booking. This lists the ones it left
-- stranded, so the dashboard can flag them for her to move or confirm.

create or replace function public.upcoming_conflicts()
returns table (booking_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id
  from public.bookings b
  where b.profile_id = (select auth.uid())
    and b.status = 'booked'
    and b.starts_at > now()
    and not public.staff_slot_ok(
      b.staff_id,
      b.service_id,
      b.starts_at,
      (extract(epoch from b.ends_at - b.starts_at) / 60)::int
    );
$$;

revoke execute on function public.upcoming_conflicts() from public;
grant execute on function public.upcoming_conflicts() to authenticated;
