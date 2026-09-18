import type { Metadata } from "next";

import { BrandLock } from "@/components/brand";
import { getSessionProfile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Set up your studio",
};

export default async function WelcomeLayout({
  children,
}: LayoutProps<"/welcome">) {
  // Redirects to /login when there is no session.
  await getSessionProfile();

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-5 py-6">
        <BrandLock href="/dashboard" />
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-[13px] font-semibold text-muted underline underline-offset-4"
          >
            Log out
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-[560px] flex-1 px-5 pb-16">
        <div className="card">{children}</div>
      </main>
    </div>
  );
}
