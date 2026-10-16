-- Pay at setup, no free period
--
-- A business now chooses a plan as the last step of setup. Until it has paid,
-- its booking page stays paused and the dashboard asks for a plan; there is no
-- longer a grace period after the first booking. 'trialing' (the column
-- default) now simply means "not paid yet".

create or replace function public.is_page_live(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select pr.subscription_status in ('active', 'past_due')
    from public.profiles pr
    where pr.id = p_profile_id
  ), false);
$$;

comment on column public.profiles.first_booking_at is
  'When her first booking came in. Informational only; billing no longer depends on it.';
