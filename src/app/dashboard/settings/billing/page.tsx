import type { Metadata } from "next";

import { accessFor } from "@/lib/billing";
import { requireProfile } from "@/lib/profile";

import { ManageBilling } from "./manage-billing";
import { PlanPicker } from "./plan-picker";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const profile = await requireProfile();
  const access = accessFor(profile);

  const status =
    access.state === "paid"
      ? access.pastDue
        ? "Your last payment didn't go through. Update your card to keep your dashboard open."
        : "Your plan is active. Thank you!"
      : "Choose a plan to put your booking page live.";

  return (
    <div className="max-w-[720px]">
      <h1 className="font-display text-[27px] leading-none">Billing &amp; subscription</h1>

      <div className="card mt-6">
        <p className="text-[13px] font-bold text-muted">Your plan</p>
        <p className="mt-2 text-[15px]">{status}</p>
        {profile.stripe_customer_id && <ManageBilling />}
      </div>

      {access.state !== "paid" && (
        <div className="mt-6">
          <PlanPicker />
        </div>
      )}
    </div>
  );
}
