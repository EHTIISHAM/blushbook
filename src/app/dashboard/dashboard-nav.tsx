"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The day-to-day sections. Setup lives behind Settings. */
const TABS = [
  { href: "/dashboard", label: "Bookings" },
  { href: "/dashboard/availability", label: "Availability" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/analytics", label: "Analytics" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard sections">
      <ul className="mx-auto grid w-full max-w-[1080px] grid-cols-4 px-2 sm:flex sm:gap-1 sm:px-5">
        {TABS.map((tab) => {
          // "/dashboard" is the Bookings tab, so it only matches exactly.
          const isActive =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`-mb-px block whitespace-nowrap border-b-2 px-1 py-3 text-center text-[14px] font-semibold no-underline sm:px-3 sm:text-[15px] ${
                  isActive
                    ? "border-accent text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/** Settings sits apart from the tabs but still shows when you're inside it. */
export function SettingsButton() {
  const pathname = usePathname();
  const isActive = pathname.startsWith("/dashboard/settings");

  return (
    <Link
      href="/dashboard/settings"
      aria-current={isActive ? "page" : undefined}
      className={`btn btn-ghost btn-sm !px-2.5 sm:!px-4 ${isActive ? "!shadow-[inset_0_0_0_1.5px_var(--ink)]" : ""}`}
    >
      <GearIcon />
      <span className="hidden sm:inline">Settings</span>
      <span className="sr-only sm:hidden">Settings</span>
    </Link>
  );
}

/** Her booking link, one tap away from anywhere in the dashboard. */
export function CopyLinkButton({ url }: { url: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the Share page shows the link to copy by hand.
      router.push("/dashboard/settings/share");
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-sm whitespace-nowrap !px-3.5" aria-live="polite">
      <LinkIcon />
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
