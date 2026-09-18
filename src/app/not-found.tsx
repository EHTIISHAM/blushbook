import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 py-16 text-center">
      <BrandMark className="mx-auto h-14 w-12" />

      <h1 className="mt-6 font-serif text-[44px] leading-none">
        This link doesn&rsquo;t go anywhere
      </h1>

      <p className="mt-4 text-[16px] text-muted">
        The page you&rsquo;re after has moved, or the booking link was typed
        slightly wrong. Worth checking it with whoever sent it to you.
      </p>

      <div className="mt-8">
        <Link href="/" className="btn">
          Go to Blushbook
        </Link>
      </div>
    </main>
  );
}
