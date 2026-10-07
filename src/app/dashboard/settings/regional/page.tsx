import type { Metadata } from "next";

import { requireProfile } from "@/lib/profile";

import { RegionalForm } from "./regional-form";

export const metadata: Metadata = { title: "Currency & timezone" };

/** Every IANA zone, with a small fallback for runtimes that lack the list. */
function timezoneOptions(current: string): string[] {
  let zones: string[];

  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [
      "UTC",
      "Europe/London",
      "America/New_York",
      "America/Chicago",
      "America/Los_Angeles",
      "Asia/Dubai",
      "Asia/Karachi",
      "Australia/Sydney",
    ];
  }

  // Keep her saved zone selectable even if this runtime does not list it.
  return zones.includes(current) ? zones : [current, ...zones];
}

export default async function RegionalPage() {
  const profile = await requireProfile();

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-[27px] leading-none">
        Currency &amp; timezone
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        How your prices and times read, on your booking page and in here.
      </p>

      <RegionalForm
        timezone={profile.timezone}
        currency={profile.currency}
        timezones={timezoneOptions(profile.timezone)}
      />
    </div>
  );
}
