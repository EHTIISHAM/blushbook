import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

import { SetupWizard } from "./setup-wizard";

/**
 * Resume wherever she left off. Every step writes as it completes, so a
 * half-finished setup survives closing the tab, and someone who already has
 * services and hours lands on the finished screen rather than being walked
 * through it again.
 */
function startingStep(input: {
  hasName: boolean;
  services: number;
  availability: number;
}): number {
  if (!input.hasName) return 0;
  if (input.services === 0) return 1;
  if (input.availability === 0) return 2;
  return 3; // past the last step: the finished screen
}

export default async function WelcomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [services, availability] = await Promise.all([
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id),
    supabase
      .from("availability")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id),
  ]);

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://blushbook.app")
    .replace(/\/$/, "");

  return (
    <SetupWizard
      profile={profile}
      startStep={startingStep({
        hasName: profile.business_name.trim().length > 0,
        services: services.count ?? 0,
        availability: availability.count ?? 0,
      })}
      bookingHost={base.replace(/^https?:\/\//, "")}
      bookingUrl={`${base}/${profile.slug}`}
    />
  );
}
