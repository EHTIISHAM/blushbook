"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** "‹ Settings" above each settings page, but not on the list itself. */
export function SettingsBackLink() {
  const pathname = usePathname();
  if (pathname === "/dashboard/settings") return null;

  return (
    <Link
      href="/dashboard/settings"
      className="mb-4 inline-flex items-center gap-1 text-[14px] font-semibold text-muted no-underline hover:text-ink"
    >
      <span aria-hidden>‹</span> Settings
    </Link>
  );
}
