"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Bookings" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/hours", label: "Hours" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/share", label: "Share" },
  { href: "/dashboard/billing", label: "Billing" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard sections" className="border-b border-line">
      <ul className="mx-auto flex w-full max-w-[1080px] gap-1 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                className={`-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-3 text-[15px] font-semibold no-underline ${
                  isActive
                    ? "border-cherry text-ink"
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
