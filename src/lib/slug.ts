import { z } from "zod";

/**
 * Slugs that would shadow a real route. Keep this in step with
 * profiles_slug_not_reserved in supabase/migrations/20260917120000_init.sql —
 * the database is the one that actually enforces it.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "auth",
  "login",
  "logout",
  "signup",
  "dashboard",
  "account",
  "admin",
  "terms",
  "privacy",
  "refunds",
  "pricing",
  "support",
  "help",
  "blog",
  "about",
  "contact",
  "app",
  "www",
  "static",
  "public",
  "assets",
  "new",
  "settings",
  "billing",
  "book",
  "bookings",
]);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Your link needs at least 3 characters.")
  .max(30, "Keep your link under 30 characters.")
  .regex(
    SLUG_PATTERN,
    "Use lowercase letters, numbers, dashes and underscores, starting and ending with a letter or number.",
  )
  .refine((value) => !RESERVED_SLUGS.has(value), {
    message: "That one is reserved. Try another.",
  });

/** Best-effort cleanup of whatever she types into the link field. */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
