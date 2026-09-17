import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/database.types";

export interface SessionProfile {
  userId: string;
  email: string | null;
  /** Null only if the signup trigger has not run for this account yet. */
  profile: ProfileRow | null;
}

/**
 * The signed-in tech and her profile row.
 *
 * Wrapped in cache() so a layout and its pages share one round trip per render.
 * Redirects to /login when there is no session, which also covers the case
 * where the cookie expired between the middleware check and this query.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
  };
});

/** Same, but guarantees a profile row — use it inside the dashboard tabs. */
export async function requireProfile(): Promise<ProfileRow> {
  const { profile } = await getSessionProfile();

  if (!profile) {
    redirect("/dashboard");
  }

  return profile;
}
