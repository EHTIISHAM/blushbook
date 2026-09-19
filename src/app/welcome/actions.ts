"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { timeValueToMinutes } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { slugSchema } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function isKnownTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------
   Step 1 — her studio
   ------------------------------------------------------------------------- */

const studioSchema = z.object({
  business_name: z
    .string()
    .trim()
    .min(1, "What should clients see at the top of your page?")
    .max(80, "Keep your business name under 80 characters."),
  slug: slugSchema,
  // Detected from her browser rather than asked for, then validated here
  // because anything coming from a form is untrusted.
  timezone: z
    .string()
    .trim()
    .refine(isKnownTimezone, { message: "That timezone isn't recognised." })
    .optional(),
});

export async function saveStudio(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawTimezone = String(formData.get("timezone") ?? "").trim();

  const parsed = studioSchema.safeParse({
    business_name: formData.get("business_name"),
    slug: formData.get("slug"),
    timezone: rawTimezone || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: firstIssue(parsed.error) };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  if (parsed.data.slug !== profile.slug) {
    const { error } = await supabase.rpc("set_slug", {
      p_slug: parsed.data.slug,
    });

    if (error) {
      return {
        status: "error",
        message:
          error.code === "23505"
            ? "Someone already has that link. Try another."
            : error.message,
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: parsed.data.business_name,
      ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
    })
    .eq("id", profile.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/welcome");
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Saved." };
}

/* -------------------------------------------------------------------------
   Step 2 — her first service
   ------------------------------------------------------------------------- */

const money = z
  .coerce.number<number>()
  .min(0, "Must be zero or more.")
  .max(100000, "That's higher than this form allows.")
  .transform((value) => Math.round(value * 100));

const firstServiceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give the service a name.")
      .max(80, "Keep the name under 80 characters."),
    duration_minutes: z.coerce
      .number<number>()
      .int("Use whole minutes.")
      .min(5, "Minimum is 5 minutes.")
      .max(1440, "Maximum is 24 hours."),
    price_cents: money,
    deposit_cents: money.default(0),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a 3 letter currency code, like USD."),
  })
  .refine((value) => value.deposit_cents <= value.price_cents, {
    message: "The deposit can't be more than the price.",
    path: ["deposit_cents"],
  });

export async function addFirstService(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = firstServiceSchema.safeParse({
    name: formData.get("name"),
    duration_minutes: formData.get("duration_minutes"),
    price_cents: formData.get("price"),
    // Deposits are not part of setup right now; services start at zero and
    // she can add one later on the Services tab.
    deposit_cents: 0,
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { status: "error", message: firstIssue(parsed.error) };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const { currency, ...service } = parsed.data;

  if (currency !== profile.currency) {
    await supabase
      .from("profiles")
      .update({ currency })
      .eq("id", profile.id);
  }

  const { data: last } = await supabase
    .from("services")
    .select("sort_order")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("services").insert({
    ...service,
    profile_id: profile.id,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/welcome");
  revalidatePath("/dashboard/services");
  return { status: "success", message: "Service added." };
}

/* -------------------------------------------------------------------------
   Step 3 — the days she works
   ------------------------------------------------------------------------- */
// Onboarding applies one set of hours to every chosen day. Split shifts and
// per-day differences are available afterwards on the Hours tab; asking for
// them here would be seven rows of inputs before she has seen the product.

export async function saveSetupHours(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const weekdays = formData
    .getAll("weekday")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

  if (weekdays.length === 0) {
    return { status: "error", message: "Pick at least one day you work." };
  }

  const start = timeValueToMinutes(String(formData.get("start") ?? ""));
  const end = timeValueToMinutes(String(formData.get("end") ?? ""));

  if (start === null || end === null) {
    return { status: "error", message: "Add an opening and closing time." };
  }
  if (end <= start) {
    return { status: "error", message: "Your closing time is before you open." };
  }

  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_weekly_hours", {
    p_windows: weekdays.map((weekday) => ({
      weekday,
      start_minute: start,
      end_minute: end,
    })),
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/welcome");
  revalidatePath("/dashboard/hours");
  return {
    status: "success",
    message: `Open ${weekdays.length} day${weekdays.length === 1 ? "" : "s"} a week.`,
  };
}
