import type { Metadata } from "next";

import { bookingsTrend, computeAnalytics } from "@/lib/analytics";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

import {
  AnalyticsView,
  LAPSED_AFTER_DAYS,
  PERIODS,
  type PeriodKey,
} from "./analytics-view";

export const metadata: Metadata = { title: "Analytics" };

const DAY = 24 * 60 * 60 * 1000;

export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/dashboard/analytics">) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const requested = (await searchParams).period;
  const periodKey: PeriodKey =
    typeof requested === "string" && requested in PERIODS
      ? (requested as PeriodKey)
      : "30d";
  const period = PERIODS[periodKey];

  const now = new Date();
  const signedUp = new Date(profile.created_at).getTime();
  const periodStart = now.getTime() - period.days * DAY;
  // Never count open hours from before she signed up.
  const from = new Date(Math.max(periodStart, signedUp));
  // The same length of time just before, for the "vs. last period" figures.
  // Only when she had the whole of it, or the comparison would be lopsided.
  const previousFrom = new Date(periodStart - period.days * DAY);
  const hasPrevious = previousFrom.getTime() >= signedUp;

  const [bookingsResult, availabilityResult, blockedResult] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "client_name, client_contact, contact_kind, starts_at, ends_at, status, service_name, price_cents",
      )
      .eq("profile_id", profile.id)
      .order("starts_at", { ascending: true })
      .limit(20000),
    supabase
      .from("availability")
      .select("weekday, start_minute, end_minute")
      .eq("profile_id", profile.id),
    supabase.from("blocked_dates").select("blocked_on").eq("profile_id", profile.id),
  ]);

  const loadError =
    bookingsResult.error ?? availabilityResult.error ?? blockedResult.error;

  const base = {
    bookings: bookingsResult.data ?? [],
    availability: availabilityResult.data ?? [],
    blockedDates: (blockedResult.data ?? []).map((row) => row.blocked_on),
    timezone: profile.timezone,
    lapsedAfterDays: LAPSED_AFTER_DAYS,
  };
  const stats = computeAnalytics({ ...base, from, now });
  const previous = hasPrevious
    ? computeAnalytics({ ...base, from: previousFrom, now: from })
    : null;
  const trend = bookingsTrend(base.bookings, profile.timezone, from, now, period.unit);

  return (
    <AnalyticsView
      periodKey={periodKey}
      stats={stats}
      previous={previous}
      trend={trend}
      availability={base.availability}
      timezone={profile.timezone}
      currency={profile.currency}
      loadError={loadError?.message ?? null}
    />
  );
}

