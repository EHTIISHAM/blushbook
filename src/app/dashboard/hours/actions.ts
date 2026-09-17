"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { timeValueToMinutes, WEEKDAYS } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves the whole week at once. The RPC does the delete and insert inside one
 * transaction, so a bad window can never wipe her existing hours.
 */
export async function saveHours(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const windows: {
    weekday: number;
    start_minute: number;
    end_minute: number;
  }[] = [];

  for (let weekday = 0; weekday < WEEKDAYS.length; weekday += 1) {
    if (formData.get(`open-${weekday}`) !== "on") continue;

    const start = timeValueToMinutes(String(formData.get(`start-${weekday}`) ?? ""));
    const end = timeValueToMinutes(String(formData.get(`end-${weekday}`) ?? ""));

    if (start === null || end === null) {
      return {
        status: "error",
        message: `Add an opening and closing time for ${WEEKDAYS[weekday]}.`,
      };
    }

    if (end <= start) {
      return {
        status: "error",
        message: `${WEEKDAYS[weekday]} closes before it opens.`,
      };
    }

    windows.push({ weekday, start_minute: start, end_minute: end });
  }

  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_weekly_hours", {
    p_windows: windows,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard/hours");
  return {
    status: "success",
    message: windows.length
      ? "Hours saved."
      : "Saved. Your page shows no open days until you set some hours.",
  };
}

const blockedDateSchema = z.object({
  blocked_on: z.iso.date("Pick a date."),
  note: z
    .string()
    .trim()
    .max(120, "Keep the note under 120 characters.")
    .optional()
    .transform((value) => (value ? value : null)),
});

export async function blockDate(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = blockedDateSchema.safeParse({
    blocked_on: formData.get("blocked_on"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the date.",
    };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("blocked_dates").insert({
    profile_id: profile.id,
    blocked_on: parsed.data.blocked_on,
    note: parsed.data.note,
  });

  if (error) {
    // 23505 is the unique violation on (profile_id, blocked_on).
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "That date is already blocked."
          : error.message,
    };
  }

  revalidatePath("/dashboard/hours");
  return { status: "success", message: "Date blocked." };
}

export async function unblockDate(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("blocked_dates")
    .delete()
    .eq("id", id.data)
    .eq("profile_id", profile.id);

  revalidatePath("/dashboard/hours");
}
