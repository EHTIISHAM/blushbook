"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";
import { formatMoney } from "@/lib/format";
import { ANNUAL_SAVING_CENTS, PLANS, type PlanKey } from "@/lib/plans";

import { startCheckout } from "./actions";

function PayButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn mt-4 w-full" disabled={pending}>
      {pending ? "One moment…" : label}
    </button>
  );
}

/** The two ways to pay for the one plan, each with its own Pay now button. */
export function PlanPicker() {
  const [state, formAction] = useActionState(startCheckout, IDLE);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["monthly", "annual"] as PlanKey[]).map((key) => {
          const plan = PLANS[key];
          const best = key === "annual";

          return (
            <form
              key={key}
              action={formAction}
              className={`rounded-[22px] bg-paper p-5 ${
                best
                  ? "shadow-[inset_0_0_0_2px_var(--accent)]"
                  : "shadow-[inset_0_0_0_1.5px_var(--line)]"
              }`}
            >
              <input type="hidden" name="plan" value={key} />
              <p className="flex items-center gap-2 font-bold">
                {plan.label}
                {best && (
                  <span className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] text-accent">
                    Best value
                  </span>
                )}
              </p>
              <p className="mt-3 flex flex-wrap items-baseline gap-2">
                <s className="text-[17px] text-muted">
                  {formatMoney(plan.regularCents, "USD")}
                </s>
                <span className="font-display text-[34px] leading-none">
                  {formatMoney(plan.priceCents, "USD")}
                </span>
                <span className="text-[14px] text-muted">/{plan.per}</span>
              </p>
              <p className="mt-2 text-[13px] text-muted">
                {best
                  ? `Save ${formatMoney(ANNUAL_SAVING_CENTS, "USD")} against monthly.`
                  : "Cancel anytime."}
              </p>
              <PayButton label={`Pay now, ${plan.label.toLowerCase()}`} />
            </form>
          );
        })}
      </div>

      {state.status === "error" && (
        <p className="mt-4 rounded-[14px] bg-notice px-4 py-3 text-[14px]" role="alert">
          {state.message}
        </p>
      )}

      <p className="mt-4 text-[13px] text-muted">
        Launch prices stay locked in while you stay subscribed. No commission
        and no booking fees.
      </p>
    </div>
  );
}
