import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { supabaseUrl } from "./env";

/**
 * Service-role client. It bypasses RLS, so it is only for trusted server code
 * that has already decided which row it may touch — today, the billing sync
 * driven by verified Stripe data. Never hand it anything the browser chose.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Billing cannot update profiles without it.");
  }

  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
