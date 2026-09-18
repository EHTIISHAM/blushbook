import type { Metadata } from "next";

import { requireProfile } from "@/lib/profile";

import { PhotoUpload } from "./photo-upload";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

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

export default async function ProfilePage() {
  const profile = await requireProfile();

  const siteHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "blushbook.app")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-[27px] leading-none">Profile</h1>
      <p className="mt-2 text-[15px] text-muted">
        This is what clients see at the top of your booking page.
      </p>

      <div className="mt-6">
        <PhotoUpload
          userId={profile.id}
          businessName={profile.business_name}
          initialPath={profile.photo_path}
        />
      </div>

      <ProfileForm
        profile={profile}
        timezones={timezoneOptions(profile.timezone)}
        siteHost={siteHost}
      />
    </div>
  );
}
