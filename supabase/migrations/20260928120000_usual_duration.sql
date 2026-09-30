-- Usual appointment length
--
-- Most techs don't have a time against every service on their menu. Instead of
-- asking for one per service, she sets one "usual" length on her profile and
-- any service can follow it.
--
-- services.duration_minutes stays the effective, non-null length, so the slot
-- search, create_booking and the public page keep working unchanged. A service
-- with duration_is_default = true simply has that column kept in step with the
-- profile by the two triggers below.

alter table public.profiles
  add column default_duration_minutes int not null default 60,
  add constraint profiles_default_duration_range
    check (default_duration_minutes between 5 and 1440);

alter table public.services
  add column duration_is_default boolean not null default false;

-- A service that follows the usual length takes it on insert and on every
-- update, whatever duration_minutes the client sent.
create or replace function public.services_apply_default_duration()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.duration_is_default then
    select pr.default_duration_minutes
      into new.duration_minutes
      from public.profiles pr
     where pr.id = new.profile_id;
  end if;
  return new;
end;
$$;

create trigger services_apply_default_duration
  before insert or update on public.services
  for each row execute function public.services_apply_default_duration();

-- Changing the usual length moves every service that follows it.
create or replace function public.profiles_sync_default_duration()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.services
     set duration_minutes = new.default_duration_minutes
   where profile_id = new.id
     and duration_is_default;
  return new;
end;
$$;

create trigger profiles_sync_default_duration
  after update of default_duration_minutes on public.profiles
  for each row
  when (old.default_duration_minutes is distinct from new.default_duration_minutes)
  execute function public.profiles_sync_default_duration();
