import type { ProfileRow } from "@/lib/supabase/database.types";

export type Access =
  /** Not paid yet, or plan cancelled: the dashboard waits on payment. */
  | { state: "locked"; reason: "unpaid" | "cancelled" }
  | { state: "paid"; pastDue: boolean };

/**
 * What the dashboard should show for this account. There is no free period:
 * a business pays as part of setup, and until it does the dashboard asks for
 * a plan and the public booking page stays paused.
 */
export function accessFor(profile: Pick<ProfileRow, "subscription_status">): Access {
  switch (profile.subscription_status) {
    case "active":
      return { state: "paid", pastDue: false };
    case "past_due":
      return { state: "paid", pastDue: true };
    case "cancelled":
      return { state: "locked", reason: "cancelled" };
    default:
      // "trialing" is the column default and now just means "not paid yet".
      return { state: "locked", reason: "unpaid" };
  }
}
