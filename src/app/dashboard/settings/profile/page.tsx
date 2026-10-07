import type { Metadata } from "next";

import { requireProfile } from "@/lib/profile";

import { PhotoUpload } from "./photo-upload";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Business profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();

  const siteHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "booknbloom.app")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-[27px] leading-none">Business profile</h1>
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
        siteHost={siteHost}
      />
    </div>
  );
}
