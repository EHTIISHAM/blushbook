-- Stripe replaces Paddle for the subscription.
--
-- The two Paddle columns were never written to, so they are renamed rather
-- than kept alongside. Renaming keeps the column-level revoke from the init
-- migration: signed-in users still cannot write billing columns, only the
-- service role used by the Stripe webhook can.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'paddle_customer_id'
  ) then
    alter table public.profiles rename column paddle_customer_id to stripe_customer_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'paddle_subscription_id'
  ) then
    alter table public.profiles rename column paddle_subscription_id to stripe_subscription_id;
  end if;
end
$$;

-- One Stripe customer per business, and the webhook looks profiles up by it.
create unique index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Re-run the revoke under the new names so this migration stands on its own.
revoke update (subscription_status, stripe_customer_id, stripe_subscription_id)
  on public.profiles from authenticated;
