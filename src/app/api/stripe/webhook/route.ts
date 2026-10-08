import type Stripe from "stripe";

import { stripe, syncSubscription } from "@/lib/stripe";

/**
 * Stripe webhook. Point an endpoint at /api/stripe/webhook with these events:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *
 * The signature is checked against the raw body, so it must be read as text
 * before anything parses it.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subscription =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subscription) await syncSubscription(subscription);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object.id);
        break;
    }
  } catch (error) {
    // A 500 makes Stripe retry, which is what we want for a database hiccup.
    console.error(`[stripe] ${event.type} ${event.id} failed`, error);
    return new Response("Sync failed", { status: 500 });
  }

  return Response.json({ received: true });
}
