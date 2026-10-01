import type { ProfileRow } from "@/lib/supabase/database.types";

import { GRACE_DAYS } from "./plans";

const DAY = 24 * 60 * 60 * 1000;

export type Access =
  /** Setting up, no bookings yet: everything is open. */
  | { state: "free" }
  /** Bookings have started; the free period is counting down. */
  | { state: "grace"; endsAt: Date; daysLeft: number }
  /** Free period over, or plan cancelled: the dashboard waits on payment. */
  | { state: "locked"; reason: "trial_ended" | "cancelled" }
  | { state: "paid"; pastDue: boolean };

/**
 * What the dashboard should show for this account. Only the dashboard locks;
 * the public booking page keeps taking bookings either way.
 */
export function accessFor(
  profile: Pick<ProfileRow, "subscription_status" | "first_booking_at">,
  now: Date,
): Access {
  switch (profile.subscription_status) {
    case "active":
      return { state: "paid", pastDue: false };
    case "past_due":
      return { state: "paid", pastDue: true };
    case "cancelled":
      return { state: "locked", reason: "cancelled" };
  }

  if (!profile.first_booking_at) return { state: "free" };

  const endsAt = new Date(new Date(profile.first_booking_at).getTime() + GRACE_DAYS * DAY);
  if (now >= endsAt) return { state: "locked", reason: "trial_ended" };

  return {
    state: "grace",
    endsAt,
    daysLeft: Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / DAY)),
  };
}
