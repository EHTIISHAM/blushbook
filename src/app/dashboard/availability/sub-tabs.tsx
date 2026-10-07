"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/dashboard/availability", label: "Business hours" },
  { href: "/dashboard/availability/staff", label: "Staff" },
] as const;

/** Business hours and staff schedules together answer "when can people book". */
export function AvailabilityTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Availability" className="mb-6 flex gap-2">
      {SECTIONS.map((section) => {
        const on = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full border-[1.5px] px-4 py-1.5 text-[14px] font-semibold no-underline ${
              on ? "border-ink bg-ink text-bg" : "border-line bg-paper text-ink"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
