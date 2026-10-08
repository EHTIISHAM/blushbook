import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/profile";
import { siteUrl } from "@/lib/site-url";
import { stripe, syncSubscription } from "@/lib/stripe";

/**
 * Where Stripe Checkout sends the business after paying.
 *
 * The webhook may land a moment after this redirect, so the subscription is
 * synced here too; otherwise she would come back to a still-locked dashboard.
 * The session must belong to the signed-in profile.
 */
export async function GET(request: NextRequest) {
  const origin = siteUrl(request.nextUrl.origin);
  const sessionId = request.nextUrl.searchParams.get("session_id");

  const { profile } = await getSessionProfile();

  if (sessionId && profile) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      const subscription =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (session.client_reference_id === profile.id && subscription) {
        await syncSubscription(subscription);
      }
    } catch (error) {
      // Not fatal: the webhook will catch up.
      console.error("[stripe] return sync failed", error);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard/settings/billing`);
}
