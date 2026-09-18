import type { Metadata } from "next";

import { formatMoney } from "@/lib/format";
import { requireProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Billing" };

const STATUS_COPY: Record<string, string> = {
  trialing: "Free until your first booking comes in.",
  active: "Your plan is active.",
  past_due: "Your last payment didn't go through. Update your card to stay live.",
  cancelled: "Your plan is cancelled and your booking page is paused.",
};

export default async function BillingPage() {
  const profile = await requireProfile();

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-[27px] leading-none">Billing</h1>

      <div className="card mt-6">
        <p className="text-[13px] font-bold text-muted">Current status</p>
        <p className="mt-1 font-display text-[20px] leading-none capitalize">
          {profile.subscription_status.replace("_", " ")}
        </p>
        <p className="mt-2 text-[15px] text-muted">
          {STATUS_COPY[profile.subscription_status] ?? ""}
        </p>

        <div className="mt-6 border-t border-line pt-5">
          <p className="flex items-baseline gap-2">
            <span className="font-display text-[30px] leading-none">
              {formatMoney(1999, "USD")}
            </span>
            <span className="text-[15px] text-muted">/month</span>
          </p>
          <p className="mt-2 text-[14px] text-muted">
            Launch price, locked in for as long as you stay subscribed. The
            regular price is {formatMoney(4799, "USD")} a month.
          </p>
        </div>
      </div>

      <p className="mt-5 text-[14px] text-muted">
        Paddle checkout and the customer portal are the last piece of the build.
        Until then nothing is charged and your account stays on the free trial.
      </p>
    </div>
  );
}
