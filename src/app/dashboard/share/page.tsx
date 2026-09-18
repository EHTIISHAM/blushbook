import type { Metadata } from "next";

import { requireProfile } from "@/lib/profile";

import { CopyField } from "./copy-field";

export const metadata: Metadata = { title: "Share" };

export default async function SharePage() {
  const profile = await requireProfile();

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://blushbook.app")
    .replace(/\/$/, "");
  const bookingUrl = `${base}/${profile.slug}`;

  const studio = profile.business_name.trim() || "my studio";

  const dmReply = `Hey babe! All my open times are here 💕\n${bookingUrl}\n\nPick your service and time, and the deposit link comes up right after.`;

  const bioLine = `Book here 💅 ${bookingUrl.replace(/^https?:\/\//, "")}`;

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-[27px] leading-none">Share</h1>
      <p className="mt-2 text-[15px] text-muted">
        One link for {studio}. Put it in your bio and send it to anyone who
        asks.
      </p>

      <div className="card mt-6 grid gap-7">
        <CopyField label="Your booking link" value={bookingUrl} />
        <CopyField label="For your Instagram or TikTok bio" value={bioLine} />
        <CopyField label="A reply for booking DMs" value={dmReply} multiline />
      </div>

      <p className="mt-5 text-[14px] text-muted">
        Your link goes live with the public booking page, which is the next
        piece of the build. Changing your link name is on the{" "}
        <strong>Profile</strong> tab.
      </p>
    </div>
  );
}
