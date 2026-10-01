import type { Metadata } from "next";
import Link from "next/link";

import { BrandLock } from "@/components/brand";
import { accessFor } from "@/lib/billing";
import { getSessionProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

import { PlanPicker } from "./billing/plan-picker";
import { DashboardNav } from "./dashboard-nav";

export const metadata: Metadata = {
  title: "Dashboard",
};

/** Shown in place of the dashboard once the free period is over. */
async function Paywall({
  profileId,
  since,
  cancelled,
}: {
  profileId: string;
  since: string | null;
  cancelled: boolean;
}) {
  const supabase = await createClient();
  const { count } = since
    ? await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId)
        .gte("created_at", since)
    : { count: 0 };
  const bookings = count ?? 0;

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="rounded-[26px] bg-tint px-6 py-8 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-accent">
          {cancelled ? "Plan cancelled" : "Your free period has ended"}
        </p>
        <h1 className="mt-3 font-display text-[28px] leading-tight">
          {bookings > 0
            ? `${bookings} booking${bookings === 1 ? " is" : "s are"} waiting for you`
            : "Your bookings are waiting for you"}
        </h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-[15px] text-muted">
          {cancelled
            ? "Choose a plan to open your dashboard again and see who has booked."
            : "Clients have started booking through your link. Choose a plan to open your dashboard, see who's booked and keep your numbers coming."}{" "}
          Your booking page stays live in the meantime.
        </p>
      </div>

      <div className="mt-6">
        <PlanPicker />
      </div>
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { email, profile } = await getSessionProfile();
  const access = profile ? accessFor(profile, new Date()) : null;
  const locked = access?.state === "locked";

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-4 px-5 py-4">
        <BrandLock href="/dashboard" />

        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden text-[13px] text-muted sm:inline">
              {email}
            </span>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost btn-sm">
              Log out
            </button>
          </form>
        </div>
      </header>

      {!locked && <DashboardNav />}

      {access?.state === "grace" && (
        <div className="bg-notice">
          <p className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-3 text-[14px]">
            <span>
              <strong>Bookings are coming in.</strong> Your free period ends in{" "}
              {access.daysLeft} day{access.daysLeft === 1 ? "" : "s"}. Choose a
              plan to keep your dashboard open.
            </span>
            <Link href="/dashboard/billing" className="btn btn-sm">
              Choose a plan
            </Link>
          </p>
        </div>
      )}

      {access?.state === "paid" && access.pastDue && (
        <div className="bg-notice">
          <p className="mx-auto w-full max-w-[1080px] px-5 py-3 text-[14px]">
            Your last payment didn&rsquo;t go through. Update your card on the{" "}
            <Link href="/dashboard/billing" className="font-semibold underline underline-offset-4">
              Billing
            </Link>{" "}
            tab to keep your dashboard open.
          </p>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8">
        {locked && profile ? (
          <Paywall
            profileId={profile.id}
            since={profile.first_booking_at}
            cancelled={access.reason === "cancelled"}
          />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
