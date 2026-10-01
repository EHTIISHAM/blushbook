-- Phone first, email optional
--
-- Clients now book with a phone number (used for WhatsApp follow-ups) and may
-- add an email. Instagram handles are no longer offered on the booking form;
-- the enum value stays so older bookings keep their contact.
--
-- New bookings always use contact_kind = 'whatsapp' with the number in
-- client_contact, so analytics keep matching returning clients by number.

alter table public.bookings
  add column client_email text,
  add constraint bookings_client_email_format check (
    client_email is null
    or (length(client_email) <= 254 and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

-- The signature changes, so the old function has to go first.
drop function public.create_booking(
  text, uuid, timestamptz, text, text, public.contact_kind, text
);

create function public.create_booking(
  p_slug           text,
  p_service_id     uuid,
  p_starts_at      timestamptz,
  p_client_name    text,
  p_client_contact text,
  p_contact_kind   public.contact_kind,
  p_ip_hash        text,
  p_client_email   text default null
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
    raise exception 'That time is outside working hours.'
      using errcode = 'P0001';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  begin
    insert into public.bookings (
      profile_id, service_id, client_name, client_contact, contact_kind,
      client_email, starts_at, ends_at, service_name, price_cents, deposit_cents
    )
    values (
      v_profile.id, v_service.id, btrim(p_client_name), btrim(p_client_contact),
      p_contact_kind, nullif(lower(btrim(p_client_email)), ''), p_starts_at,
      v_ends_at, v_service.name, v_service.price_cents, v_service.deposit_cents
    )
    returning * into v_booking;
  exception when exclusion_violation then
    -- Someone took it between the page loading and this insert.
    raise exception 'Sorry, that slot was just booked. Please pick another.'
      using errcode = 'P0001';
  end;

  -- The first booking starts the clock on activating the plan.
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
  text, uuid, timestamptz, text, text, public.contact_kind, text, text
) from public;
grant execute on function public.create_booking(
  text, uuid, timestamptz, text, text, public.contact_kind, text, text
) to anon, authenticated;
