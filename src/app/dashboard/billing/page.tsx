import type { Metadata } from "next";

import { accessFor } from "@/lib/billing";
import { GRACE_DAYS } from "@/lib/plans";
import { requireProfile } from "@/lib/profile";

import { PlanPicker } from "./plan-picker";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const profile = await requireProfile();
  const access = accessFor(profile, new Date());

  const status =
    access.state === "paid"
      ? access.pastDue
        ? "Your last payment didn't go through. Update your card to keep your dashboard open."
        : "Your plan is active. Thank you!"
      : access.state === "grace"
        ? `Your bookings have started. You have ${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"} left to choose a plan.`
        : `Free while you set up. Once bookings start, you have ${GRACE_DAYS} days to choose a plan.`;

  return (
    <div className="max-w-[720px]">
      <h1 className="font-display text-[27px] leading-none">Billing</h1>

      <div className="card mt-6">
        <p className="text-[13px] font-bold text-muted">Your plan</p>
        <p className="mt-2 text-[15px]">{status}</p>
      </div>

      {access.state !== "paid" && (
        <div className="mt-6">
          <PlanPicker />
        </div>
      )}
    </div>
  );
}
