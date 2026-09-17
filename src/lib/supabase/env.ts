/**
 * Supabase credentials, read once and checked loudly.
 *
 * These are only ever read at request time, never while Next prerenders, so
 * the app still builds before a Supabase project exists.
 */

const MISSING =
  "Supabase is not configured. Copy .env.example to .env.local and fill in " +
  "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your " +
  "project's API settings.";

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error(MISSING);
  return url;
}

export function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error(MISSING);
  return key;
}

/** True when both public credentials are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
