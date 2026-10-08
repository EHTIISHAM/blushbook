import "server-only";

import Stripe from "stripe";

import type { PlanKey } from "./plans";
import type { SubscriptionStatus } from "./supabase/database.types";
import { createAdminClient } from "./supabase/admin";

/**
 * Stripe, server side only. Set in .env.local / the VM's .env:
 *   STRIPE_SECRET_KEY       sk_test_… or sk_live_… (a restricted key works too)
 *   STRIPE_WEBHOOK_SECRET   whsec_… from the webhook endpoint
 *   STRIPE_PRICE_MONTHLY    price_… for $19.99 / month
 *   STRIPE_PRICE_ANNUAL     price_… for $210 / year
 */

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_ANNUAL,
  );
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  client ??= new Stripe(key);
  return client;
}

export function priceFor(plan: PlanKey): string {
  const price =
    plan === "monthly" ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_ANNUAL;
  if (!price) throw new Error(`Stripe price for the ${plan} plan is not set.`);
  return price;
}

/**
 * How a Stripe subscription status reads on our side, or null when it should
 * not change anything: "incomplete" is a checkout still waiting on the card.
 */
function toStatus(status: Stripe.Subscription.Status): SubscriptionStatus | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "cancelled";
    default:
      return null;
  }
}

/**
 * Copies a subscription's current state onto its profile.
 *
 * Always re-reads the subscription from Stripe rather than trusting the event
 * payload, so webhooks arriving out of order or twice still end up correct.
 */
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const admin = createAdminClient();

  // Checkout stamps the profile id on the subscription; fall back to the
  // customer for anything created by hand in the Stripe dashboard.
  let profileId = subscription.metadata.profile_id || null;
  if (!profileId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    profileId = data?.id ?? null;
  }
  if (!profileId) {
    console.warn(`[stripe] subscription ${subscriptionId} matches no profile`);
    return;
  }

  const status = toStatus(subscription.status);

  // A cancelled old subscription must not overwrite a newer live one.
  if (status === "cancelled") {
    const { data: current } = await admin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", profileId)
      .maybeSingle();
    if (current?.stripe_subscription_id && current.stripe_subscription_id !== subscription.id) {
      return;
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      ...(status ? { subscription_status: status } : {}),
    })
    .eq("id", profileId);

  if (error) throw new Error(`[stripe] could not update profile ${profileId}: ${error.message}`);
}
