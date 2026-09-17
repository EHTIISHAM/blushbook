import type { Metadata } from "next";

import { BrandLock } from "@/components/brand";
import { getSessionProfile } from "@/lib/profile";

import { DashboardNav } from "./dashboard-nav";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { email } = await getSessionProfile();

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-4 px-5 py-4">
        <BrandLock href="/dashboard" />

        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden text-[13px] text-muted sm:inline">
              {email}
            </span>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost btn-sm">
              Log out
            </button>
          </form>
        </div>
      </header>

      <DashboardNav />

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}
