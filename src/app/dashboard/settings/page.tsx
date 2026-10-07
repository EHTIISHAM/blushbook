import type { Metadata } from "next";
import Link from "next/link";

import { accessFor } from "@/lib/billing";
import { getSessionProfile, requireProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "Settings" };

function planLine(access: ReturnType<typeof accessFor>): string {
  switch (access.state) {
    case "free":
      return "Free while you set up";
    case "grace":
      return `Free period ends in ${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"}`;
    case "paid":
      return access.pastDue ? "Payment needs attention" : "Plan active";
    case "locked":
      return "Choose a plan";
  }
}

export default async function SettingsPage() {
  const profile = await requireProfile();
  const { email } = await getSessionProfile();
  const access = accessFor(profile, new Date());

  const sections = [
    {
      href: "/dashboard/settings/profile",
      title: "Business profile",
      detail: "Name, photo, bio, booking link and cancellation policy",
    },
    {
      href: "/dashboard/settings/regional",
      title: "Currency & timezone",
      detail: `${profile.currency} · ${profile.timezone.replace(/_/g, " ")}`,
    },
    {
      href: "/dashboard/settings/share",
      title: "Share booking link",
      detail: "Ready-made messages for WhatsApp, Instagram and your website",
    },
    {
      href: "/dashboard/settings/billing",
      title: "Billing & subscription",
      detail: planLine(access),
    },
  ];

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-[27px] leading-none">Settings</h1>

      <ul className="card mt-6 grid grid-cols-[minmax(0,1fr)] !p-0">
        {sections.map((section, index) => (
          <li key={section.href} className={`min-w-0 ${index > 0 ? "border-t border-line" : ""}`}>
            <Link
              href={section.href}
              className="flex items-center gap-3 px-5 py-4 text-ink no-underline hover:bg-bubble/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{section.title}</span>
                <span className="block text-[14px] text-muted">
                  {section.detail}
                </span>
              </span>
              <span aria-hidden className="text-[20px] text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[13px] text-muted">Signed in as</span>
          <span className="block truncate text-[15px] font-semibold">
            {email ?? "your Google account"}
          </span>
        </span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-ghost btn-sm">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
