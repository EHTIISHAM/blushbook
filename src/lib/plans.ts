/**
 * The one plan, billed monthly or yearly. Shared by the landing page and the
 * Billing tab so the two can never quote different prices.
 */

export type PlanKey = "monthly" | "annual";

export interface Plan {
  key: PlanKey;
  label: string;
  /** What it costs now, in US cents. */
  priceCents: number;
  /** The regular price shown struck through. */
  regularCents: number;
  per: "month" | "year";
}

export const PLANS: Record<PlanKey, Plan> = {
  monthly: {
    key: "monthly",
    label: "Monthly",
    priceCents: 1999,
    regularCents: 4799,
    per: "month",
  },
  annual: {
    key: "annual",
    label: "Annual",
    priceCents: 21000,
    regularCents: 47000,
    per: "year",
  },
};

/** What a year costs on the monthly plan, minus the annual price. */
export const ANNUAL_SAVING_CENTS =
  PLANS.monthly.priceCents * 12 - PLANS.annual.priceCents;

/** Days a business keeps full access after its first booking before paying. */
export const GRACE_DAYS = 3;
