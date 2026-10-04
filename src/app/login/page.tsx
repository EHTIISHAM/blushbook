import { Suspense } from "react";
import type { Metadata } from "next";

import { BrandLock } from "@/components/brand";

import { GoogleButton } from "./google-button";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your BooknBloom dashboard.",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-5 py-12">
      <div className="mb-8 flex justify-center">
        <BrandLock />
      </div>

      <div className="card">
        <h1 className="font-display text-[26px] leading-none">Welcome back</h1>
        <p className="mt-3 text-[15px] text-muted">
          Sign in with your Google account. No password to remember.
        </p>

        <Suspense
          fallback={<div className="btn btn-ghost mt-6 w-full opacity-40" aria-hidden />}
        >
          <GoogleButton />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-[13px] text-muted">
        New here? Use the same button — your account is created the first time
        you sign in.
      </p>
    </main>
  );
}
