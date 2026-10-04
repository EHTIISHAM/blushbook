"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/** Errors the callback sends back here, in words she can act on. */
const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: "Google sign-in was cancelled. Try again when you're ready.",
  missing_code: "That sign-in didn't finish. Please try again.",
  link_expired: "That sign-in expired. Please try again.",
};

type Status =
  | { kind: "idle" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string };

export function GoogleButton() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const [status, setStatus] = useState<Status>(
    callbackError
      ? {
          kind: "error",
          message:
            CALLBACK_ERRORS[callbackError] ??
            "Sign-in didn't work. Please try again.",
        }
      : { kind: "idle" },
  );

  async function onClick() {
    setStatus({ kind: "redirecting" });

    // "next" is where the dashboard should land once Google sends her back.
    const next = searchParams.get("next") ?? "/dashboard";
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          // Always show the account chooser, so a shared device doesn't
          // silently sign in as whoever used it last.
          queryParams: { prompt: "select_account" },
        },
      });

      // On success the browser is already navigating to Google.
      if (error) setStatus({ kind: "error", message: error.message });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={onClick}
        disabled={status.kind === "redirecting"}
      >
        <GoogleMark />
        {status.kind === "redirecting"
          ? "Opening Google…"
          : "Continue with Google"}
      </button>

      {status.kind === "error" && (
        <p className="hint text-accent" role="alert">
          {status.message}
        </p>
      )}
    </div>
  );
}

/** Google's "G", in its own colours as their branding guidelines require. */
function GoogleMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
