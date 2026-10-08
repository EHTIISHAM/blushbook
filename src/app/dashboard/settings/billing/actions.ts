"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { getSessionProfile } from "@/lib/profile";
import { siteUrl } from "@/lib/site-url";
import { isStripeConfigured, priceFor, stripe } from "@/lib/stripe";

const planSchema = z.enum(["monthly", "annual"]);

const UNAVAILABLE: ActionState = {
  status: "error",
  message:
    "Payments aren't available just yet. Please try again shortly, and your bookings stay safe in the meantime.",
};

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return siteUrl(`${proto}://${host}`);
}

/**
 * Sends the business to Stripe Checkout for the chosen plan.
 *
 * The profile id rides along as client_reference_id and as subscription
 * metadata, which is how the webhook and the return route find the profile
 * again. Nothing here marks the account paid; only verified Stripe data does.
 */
export async function startCheckout(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const plan = planSchema.safeParse(formData.get("plan"));
  if (!plan.success) {
    return { status: "error", message: "Pick monthly or annual." };
  }

  const { profile, email } = await getSessionProfile();
  if (!profile) redirect("/dashboard");

  if (!isStripeConfigured()) return UNAVAILABLE;

  // Already paying: send them to manage the plan instead of a second one.
  if (profile.subscription_status === "active" || profile.subscription_status === "past_due") {
    return openBillingPortal();
  }

  const base = await origin();

  let url: string | null;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceFor(plan.data), quantity: 1 }],
      client_reference_id: profile.id,
      ...(profile.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: email ?? undefined }),
      subscription_data: { metadata: { profile_id: profile.id } },
      allow_promotion_codes: true,
      success_url: `${base}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard/settings/billing`,
    });
    url = session.url;
  } catch (error) {
    console.error("[stripe] checkout session failed", error);
    return UNAVAILABLE;
  }

  if (!url) return UNAVAILABLE;
  redirect(url);
}

/** Stripe's hosted page for changing card, switching plan or cancelling. */
export async function openBillingPortal(): Promise<ActionState> {
  const { profile } = await getSessionProfile();
  if (!profile?.stripe_customer_id || !isStripeConfigured()) return UNAVAILABLE;

  const base = await origin();

  let url: string;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${base}/dashboard/settings/billing`,
    });
    url = session.url;
  } catch (error) {
    console.error("[stripe] billing portal session failed", error);
    return UNAVAILABLE;
  }

  redirect(url);
}
