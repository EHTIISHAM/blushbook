import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLock } from "@/components/brand";
import { accessFor } from "@/lib/billing";
import { getSessionProfile } from "@/lib/profile";

import { PlanPicker } from "./settings/billing/plan-picker";
import { CopyLinkButton, DashboardNav, SettingsButton } from "./dashboard-nav";

export const metadata: Metadata = {
  title: "Dashboard",
};

/** Shown in place of the dashboard until the business has an active plan. */
function Paywall({ cancelled }: { cancelled: boolean }) {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="rounded-[26px] bg-tint px-6 py-8 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-accent">
          {cancelled ? "Plan cancelled" : "Last step"}
        </p>
        <h1 className="mt-3 font-display text-[28px] leading-tight">
          {cancelled ? "Your booking page is paused" : "Choose a plan to go live"}
        </h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-[15px] text-muted">
          {cancelled
            ? "Choose a plan to switch your booking page back on and open your dashboard again."
            : "Your page is set up. Choose a plan to put your booking link live and open your dashboard."}
        </p>
      </div>

      <div className="mt-6">
        <PlanPicker />
      </div>
    </div>
  );
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://booknbloom.app").replace(/\/$/, "");
}

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { profile } = await getSessionProfile();

  // A brand-new account lands here straight from its first sign-in. Send it
  // through setup once; naming the business is what marks that as done, so
  // this cannot bounce anyone back after they have started. Setup ends with
  // choosing a plan.
  if (profile && !profile.business_name.trim()) {
    redirect("/welcome");
  }

  const access = profile ? accessFor(profile) : null;
  const locked = access?.state === "locked";

  return (
    <div className="flex min-h-full flex-col">
      {/* Pinned, so switching section never means scrolling back up. */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <BrandLock href="/dashboard" />

          {locked || !profile ? (
            // Settings is out of reach behind the paywall, so log out stays here.
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn btn-ghost btn-sm">
                Log out
              </button>
            </form>
          ) : (
            <div className="flex flex-none items-center gap-1.5 sm:gap-2">
              <CopyLinkButton url={`${siteBase()}/${profile.slug}`} />
              <SettingsButton />
            </div>
          )}
        </div>

        {!locked && <DashboardNav />}
      </header>

      {access?.state === "paid" && access.pastDue && (
        <div className="bg-notice">
          <p className="mx-auto w-full max-w-[1080px] px-5 py-3 text-[14px]">
            Your last payment didn&rsquo;t go through. Update your card in{" "}
            <Link href="/dashboard/settings/billing" className="font-semibold underline underline-offset-4">
              Billing
            </Link>{" "}
            to keep your dashboard open.
          </p>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8">
        {locked && profile ? (
          <Paywall cancelled={access.reason === "cancelled"} />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
