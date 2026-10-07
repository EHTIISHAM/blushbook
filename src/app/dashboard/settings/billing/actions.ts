"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { requireProfile } from "@/lib/profile";

const planSchema = z.enum(["monthly", "annual"]);

/**
 * Sends the business to pay for a plan.
 *
 * Stripe is connected here once the account is ready: create a Checkout
 * Session for STRIPE_PRICE_MONTHLY or STRIPE_PRICE_ANNUAL with the profile id
 * as client_reference_id, redirect to its url, and let the Stripe webhook set
 * subscription_status to "active". Until then the button explains itself
 * without mentioning any of that.
 */
export async function startCheckout(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const plan = planSchema.safeParse(formData.get("plan"));
  if (!plan.success) {
    return { status: "error", message: "Pick monthly or annual." };
  }

  await requireProfile();

  const checkoutUrl: string | null = null;
  if (checkoutUrl) redirect(checkoutUrl);

  return {
    status: "error",
    message:
      "Payments aren't available just yet. Please try again shortly, and your bookings stay safe in the meantime.",
  };
}
