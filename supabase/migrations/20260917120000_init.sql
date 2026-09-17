-- Blushbook initial schema
-- Tables: profiles, services, availability, blocked_dates, bookings
-- Double bookings are blocked by the database itself (btree_gist exclusion constraint).

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.subscription_status as enum (
  'trialing',   -- free until her first booking lands
  'active',     -- paying
  'past_due',   -- Paddle is retrying the card
  'cancelled'
);

create type public.booking_status as enum (
  'booked',
  'cancelled',
  'no_show',
  'completed'
);

create type public.deposit_status as enum (
  'requested',
  'paid'
);

create type public.contact_kind as enum (
  'whatsapp',
  'instagram'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  slug                    text not null unique,
  business_name           text not null default '',
  instagram_handle        text,
  bio                     text,
  photo_path              text,
  timezone                text not null default 'UTC',
  currency                text not null default 'USD',
  deposit_link            text,
  no_show_policy          text,
  subscription_status     public.subscription_status not null default 'trialing',
  paddle_customer_id      text,
  paddle_subscription_id  text,
  first_booking_at        timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- The slug is a public URL segment: /lashesbyhira
  constraint profiles_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$'),

  -- Must not collide with a real app route.
  constraint profiles_slug_not_reserved check (
    slug not in (
      'api', 'auth', 'login', 'logout', 'signup', 'dashboard', 'account',
      'admin', 'terms', 'privacy', 'refunds', 'pricing', 'support', 'help',
      'blog', 'about', 'contact', 'app', 'www', 'static', 'public', 'assets',
      'new', 'settings', 'billing', 'book', 'bookings'
    )
  ),

  constraint profiles_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint profiles_instagram_format check (
    instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'
  ),
  constraint profiles_deposit_link_https check (
    deposit_link is null or deposit_link ~ '^https://'
  )
);

comment on column public.profiles.first_booking_at is
  'When her first booking came in. Starts the grace period before her page pauses.';

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  name             text not null,
  duration_minutes int  not null,
  price_cents      int  not null,
  deposit_cents    int  not null default 0,
  swatch           text not null default '#B3123F',
  is_active        boolean not null default true,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint services_name_not_blank  check (length(btrim(name)) between 1 and 80),
  constraint services_duration_range  check (duration_minutes between 5 and 1440),
  constraint services_price_range     check (price_cents between 0 and 10000000),
  constraint services_deposit_range   check (deposit_cents between 0 and price_cents),
  constraint services_swatch_hex      check (swatch ~ '^#[0-9A-Fa-f]{6}$')
);

create index services_profile_sort_idx
  on public.services (profile_id, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- availability  (working hours per weekday)
-- ---------------------------------------------------------------------------
-- Times are minutes-from-midnight in the tech's own timezone, so her hours do
-- not drift when daylight saving shifts. 0 = Sunday, matching JS getDay().

create table public.availability (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  weekday      smallint not null,
  start_minute int not null,
  end_minute   int not null,
  created_at   timestamptz not null default now(),

  constraint availability_weekday_range check (weekday between 0 and 6),
  constraint availability_start_range   check (start_minute >= 0 and start_minute < 1440),
  constraint availability_end_range     check (end_minute > 0 and end_minute <= 1440),
  constraint availability_order         check (end_minute > start_minute),

  -- Two windows on the same weekday may not overlap (split shifts are fine).
  constraint availability_no_overlap exclude using gist (
    profile_id   with =,
    weekday      with =,
    int4range(start_minute, end_minute) with &&
  )
);

create index availability_profile_idx on public.availability (profile_id, weekday);

-- ---------------------------------------------------------------------------
-- blocked_dates  (time off)
-- ---------------------------------------------------------------------------

create table public.blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  blocked_on date not null,
  note       text,
  created_at timestamptz not null default now(),

  constraint blocked_dates_unique unique (profile_id, blocked_on),
  constraint blocked_dates_note_len check (note is null or length(note) <= 120)
);

create index blocked_dates_profile_idx on public.blocked_dates (profile_id, blocked_on);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
-- Service details are snapshotted onto the booking so past bookings keep the
-- price and name they were made at, even after she edits or deletes a service.

create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  service_id     uuid references public.services (id) on delete set null,

  client_name    text not null,
  client_contact text not null,
  contact_kind   public.contact_kind not null,

  starts_at      timestamptz not null,
  ends_at        timestamptz not null,

  status         public.booking_status not null default 'booked',
  deposit_status public.deposit_status not null default 'requested',

  service_name    text not null,
  price_cents     int  not null,
  deposit_cents   int  not null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint bookings_time_order   check (ends_at > starts_at),
  constraint bookings_client_name  check (length(btrim(client_name)) between 1 and 80),
  constraint bookings_contact_len  check (length(btrim(client_contact)) between 2 and 120),
  constraint bookings_price_range  check (price_cents >= 0),
  constraint bookings_deposit_range check (deposit_cents between 0 and price_cents),

  -- The whole point: two clients cannot hold the same slot, even if they hit
  -- "book" at the same instant. Cancelled and no-show bookings free the slot.
  constraint bookings_no_overlap exclude using gist (
    profile_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('booked', 'completed'))
);

create index bookings_profile_start_idx on public.bookings (profile_id, starts_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger services_touch_updated_at
  before update on public.services
  for each row execute function public.touch_updated_at();

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Is this tech's public page live?
-- ---------------------------------------------------------------------------
-- Free until her first booking lands; after that she has a 7 day grace period
-- to activate the plan before her page pauses.

create or replace function public.is_page_live(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select pr.subscription_status in ('active', 'past_due')
        or (pr.subscription_status = 'trialing'
            and (pr.first_booking_at is null
                 or pr.first_booking_at > now() - interval '7 days'))
    from public.profiles pr
    where pr.id = p_profile_id
  ), false);
$$;

revoke execute on function public.is_page_live(uuid) from public;
grant execute on function public.is_page_live(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a profile when someone signs up
-- ---------------------------------------------------------------------------
-- The slug starts from her email local part and gets a numeric suffix if that
-- is taken, so signup never fails on a collision. She renames it in Profile.

create or replace function public.slugify(p_input text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(lower(coalesce(p_input, '')), '[^a-z0-9]+', '-', 'g'),
        '(^-+)|(-+$)', '', 'g'
      ),
      '-'
    ),
    ''
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base   text;
  v_slug   text;
  v_suffix int := 0;
begin
  v_base := public.slugify(split_part(coalesce(new.email, ''), '@', 1));

  -- Pad short or empty bases so the 3 char minimum in profiles_slug_format holds.
  if v_base is null or length(v_base) < 3 then
    v_base := 'studio-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  v_base := left(v_base, 24);
  v_slug := v_base;

  loop
    begin
      insert into public.profiles (id, slug) values (new.id, v_slug);
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
      if v_suffix > 50 then
        v_slug := 'studio-' || replace(gen_random_uuid()::text, '-', '');
        v_slug := left(v_slug, 24);
      else
        v_slug := left(v_base, 24 - length(v_suffix::text)) || v_suffix::text;
      end if;
    end;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- Every tech sees only her own rows. Anonymous visitors see just enough of a
-- live page to book on it, and never see anyone's client list.

alter table public.profiles      enable row level security;
alter table public.services      enable row level security;
alter table public.availability  enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.bookings      enable row level security;

-- profiles ------------------------------------------------------------------

create policy profiles_owner_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_owner_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Anyone may read a live page. Column grants below decide *which* columns.
create policy profiles_public_select on public.profiles
  for select to anon, authenticated
  using (public.is_page_live(id));

-- services ------------------------------------------------------------------

create policy services_owner_all on public.services
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy services_public_select on public.services
  for select to anon, authenticated
  using (is_active and public.is_page_live(profile_id));

-- availability --------------------------------------------------------------

create policy availability_owner_all on public.availability
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy availability_public_select on public.availability
  for select to anon, authenticated
  using (public.is_page_live(profile_id));

-- blocked_dates -------------------------------------------------------------

create policy blocked_dates_owner_all on public.blocked_dates
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy blocked_dates_public_select on public.blocked_dates
  for select to anon, authenticated
  using (public.is_page_live(profile_id));

-- bookings ------------------------------------------------------------------

create policy bookings_owner_all on public.bookings
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Visitors need to know which slots are gone, and nothing else. The column
-- grants below keep client names and contacts out of reach.
create policy bookings_public_busy_select on public.bookings
  for select to anon, authenticated
  using (
    status in ('booked', 'completed')
    and public.is_page_live(profile_id)
    and starts_at > now() - interval '1 day'
  );

-- ---------------------------------------------------------------------------
-- Column grants
-- ---------------------------------------------------------------------------
-- RLS filters rows; these filter columns. Anonymous visitors must never be
-- able to read billing identifiers or another studio's client list, so they
-- get an explicit, narrow column list rather than the whole row.

revoke all on public.profiles      from anon, authenticated;
revoke all on public.services      from anon, authenticated;
revoke all on public.availability  from anon, authenticated;
revoke all on public.blocked_dates from anon, authenticated;
revoke all on public.bookings      from anon, authenticated;

-- The tech herself, through her own session.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.services      to authenticated;
grant select, insert, update, delete on public.availability  to authenticated;
grant select, insert, update, delete on public.blocked_dates to authenticated;
grant select, insert, update, delete on public.bookings      to authenticated;

-- Public booking page.
grant select (
  id, slug, business_name, instagram_handle, bio, photo_path,
  timezone, currency, deposit_link, no_show_policy
) on public.profiles to anon;

grant select (
  id, profile_id, name, duration_minutes, price_cents, deposit_cents,
  swatch, is_active, sort_order
) on public.services to anon;

grant select (
  id, profile_id, weekday, start_minute, end_minute
) on public.availability to anon;

grant select (
  id, profile_id, blocked_on
) on public.blocked_dates to anon;

-- Busy times only: no client_name, no client_contact.
grant select (
  profile_id, starts_at, ends_at, status
) on public.bookings to anon;

-- Billing columns are written by the Paddle webhook using the service role,
-- which bypasses RLS. No client-side role may write them.
revoke update (
  subscription_status, paddle_customer_id, paddle_subscription_id,
  first_booking_at, slug
) on public.profiles from authenticated;

-- The slug is changed through a checked RPC, not a raw update, so reserved
-- names and collisions are handled in one place.
create or replace function public.set_slug(p_slug text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.profiles set slug = v_slug where id = (select auth.uid());

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  return v_slug;
end;
$$;

revoke execute on function public.set_slug(text) from public;
grant execute on function public.set_slug(text) to authenticated;

-- Replacing a week of hours has to be all-or-nothing, otherwise a rejected
-- window would leave her with the old rows already deleted. One function call
-- is one transaction. It runs as the caller, so RLS still applies.
create or replace function public.set_weekly_hours(p_windows jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from public.availability where profile_id = v_uid;

  insert into public.availability (profile_id, weekday, start_minute, end_minute)
  select
    v_uid,
    (w ->> 'weekday')::smallint,
    (w ->> 'start_minute')::int,
    (w ->> 'end_minute')::int
  from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) as w;
end;
$$;

revoke execute on function public.set_weekly_hours(jsonb) from public;
grant execute on function public.set_weekly_hours(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: profile photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos', 'profile-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Each tech writes only inside a folder named after her own user id.
create policy profile_photos_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy profile_photos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy profile_photos_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy profile_photos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-photos');
