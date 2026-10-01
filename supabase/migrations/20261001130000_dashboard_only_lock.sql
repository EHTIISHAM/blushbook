-- Only the dashboard locks
--
-- Setup is free and the booking page goes live straight away. Three days after
-- the first booking the dashboard asks for payment (worked out in the app from
-- first_booking_at), but the public page keeps taking bookings so clients are
-- never turned away. A cancelled plan still pauses the page.

create or replace function public.is_page_live(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select pr.subscription_status in ('trialing', 'active', 'past_due')
    from public.profiles pr
    where pr.id = p_profile_id
  ), false);
$$;
