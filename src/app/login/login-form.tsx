"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";

const emailSchema = z.email("That email doesn't look right.");

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setStatus({ kind: "error", message: parsed.error.issues[0].message });
      return;
    }

    setStatus({ kind: "sending" });

    // "next" is where the dashboard should land after the link is clicked.
    const next = searchParams.get("next") ?? "/dashboard";
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: { emailRedirectTo: redirectTo.toString() },
      });

      if (error) {
        setStatus({ kind: "error", message: error.message });
        return;
      }

      setStatus({ kind: "sent", email: parsed.data });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="mt-6" role="status">
        <p className="rounded-[14px] bg-butter px-4 py-3 text-[15px]">
          Check your inbox. We sent a login link to{" "}
          <strong>{status.email}</strong>.
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-4"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form className="mt-6" onSubmit={onSubmit} noValidate>
      <label className="label" htmlFor="email">
        Your email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        className="field"
        autoComplete="email"
        inputMode="email"
        placeholder="hira@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={status.kind === "error"}
        aria-describedby={status.kind === "error" ? "email-error" : undefined}
        disabled={status.kind === "sending"}
        required
      />

      {status.kind === "error" && (
        <p id="email-error" className="hint text-cherry" role="alert">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        className="btn mt-5 w-full"
        disabled={status.kind === "sending"}
      >
        {status.kind === "sending" ? "Sending…" : "Email me a login link"}
      </button>
    </form>
  );
}
