import type { Metadata } from "next";

import { requireProfile } from "@/lib/profile";

import { CopyField } from "./copy-field";

export const metadata: Metadata = { title: "Share" };

export default async function SharePage() {
  const profile = await requireProfile();

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://booknbloom.app")
    .replace(/\/$/, "");
  const bookingUrl = `${base}/${profile.slug}`;

  const business = profile.business_name.trim() || "us";

  const enquiryReply = `Thanks for getting in touch! You can see all our available times and book here:\n${bookingUrl}`;

  const profileLine = `Book an appointment: ${bookingUrl.replace(/^https?:\/\//, "")}`;

  const rebookNudge = `Hi! It's been a while since your last visit to ${business}. You can book your next appointment here:\n${bookingUrl}`;

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-[27px] leading-none">Share booking link</h1>
      <p className="mt-2 text-[15px] text-muted">
        One link for every client. Add it to your website and profiles, and
        send it to anyone who asks.
      </p>

      <div className="card mt-6 grid gap-7">
        <CopyField label="Your booking link" value={bookingUrl} />
        <CopyField
          label="For your website, social profiles or email signature"
          value={profileLine}
        />
        <CopyField label="A reply to booking enquiries" value={enquiryReply} multiline />
        <CopyField label="A nudge for clients due back" value={rebookNudge} multiline />
      </div>

      <p className="mt-5 text-[14px] text-muted">
        Want a different link name? Change it on the <strong>Profile</strong>{" "}
        tab.
      </p>
    </div>
  );
}
