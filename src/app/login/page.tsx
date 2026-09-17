import { Suspense } from "react";
import type { Metadata } from "next";

import { BrandLock } from "@/components/brand";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Blushbook dashboard.",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-5 py-12">
      <div className="mb-8 flex justify-center">
        <BrandLock />
      </div>

      <div className="card">
        <h1 className="font-serif text-[38px] leading-none">Welcome back</h1>
        <p className="mt-3 text-[15px] text-muted">
          We&rsquo;ll email you a link that logs you straight in. No password to
          remember.
        </p>

        <Suspense
          fallback={<div className="field mt-6 opacity-40" aria-hidden />}
        >
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-[13px] text-muted">
        New here? Use the same form — your studio is created the first time you
        log in.
      </p>
    </main>
  );
}
