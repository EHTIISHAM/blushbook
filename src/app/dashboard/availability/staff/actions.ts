"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { conflictNote } from "@/lib/conflicts";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { parseWeek } from "@/lib/week";

const staffSchema = z.object({
  id: z.uuid().nullable(),
  name: z
    .string()
    .trim()
    .min(1, "Add their name.")
    .max(60, "Keep the name under 60 characters."),
  swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour."),
  is_active: z.boolean(),
  hours: z.enum(["business", "own"]),
  services: z.enum(["all", "some"]),
  service_ids: z.array(z.uuid()),
});

function refresh() {
  revalidatePath("/dashboard/availability/staff");
  revalidatePath("/dashboard");
}

/** Adds or edits a staff member: details, hours and services in one save. */
export async function saveStaff(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const parsed = staffSchema.safeParse({
    id: id || null,
    name: formData.get("name"),
    swatch: formData.get("swatch"),
    is_active: formData.get("is_active") === "on",
    hours: formData.get("hours"),
    services: formData.get("services"),
    service_ids: formData.getAll("service_id").map(String),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  const staff = parsed.data;
  const ownHours = staff.hours === "own";
  const someServices = staff.services === "some";

  const week = parseWeek(formData);
  if (!week.ok) {
    return { status: "error", message: week.message };
  }

  if (ownHours && week.windows.length === 0) {
    return {
      status: "error",
      message:
        "Add at least one working day, or use the business hours. To stop bookings, switch them off instead.",
    };
  }

  if (someServices && staff.service_ids.length === 0) {
    return {
      status: "error",
      message: "Tick at least one service, or choose all services.",
    };
  }

  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("save_staff", {
    p_staff_id: staff.id,
    p_name: staff.name,
    p_swatch: staff.swatch,
    p_is_active: staff.is_active,
    p_hours_follow_business: !ownHours,
    p_windows: ownHours ? week.windows : [],
    p_all_services: !someServices,
    p_service_ids: someServices ? staff.service_ids : [],
  });

  if (error) {
    // P0001 / P0002 are raised with messages written for her.
    const friendly =
      error.code === "P0001" || error.code === "P0002"
        ? error.message
        : error.code === "23503"
          ? "One of those services no longer exists. Refresh and try again."
          : error.message;
    return { status: "error", message: friendly };
  }

  refresh();
  return {
    status: "success",
    message:
      (staff.id ? `${staff.name} saved.` : `${staff.name} added.`) +
      (await conflictNote(supabase)),
  };
}

/** Removes someone who has never had a booking. Anyone else is switched off,
 *  so the history keeps who did the work. */
export async function deleteStaff(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) {
    return { status: "error", message: "That staff member no longer exists." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: others } = await supabase
    .from("staff")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .neq("id", id.data)
    .limit(1);

  if (!others?.length) {
    return {
      status: "error",
      message: "Keep at least one staff member taking bookings.",
    };
  }

  const { error } = await supabase
    .from("staff")
    .delete()
    .eq("id", id.data)
    .eq("profile_id", profile.id);

  if (error) {
    // 23503: bookings still point at them.
    return {
      status: "error",
      message:
        error.code === "23503"
          ? "They have bookings, so they can't be removed. Switch them off instead; their bookings stay."
          : error.message,
    };
  }

  refresh();
  return { status: "success", message: "Removed." };
}

const timeOffSchema = z.object({
  staff_id: z.uuid(),
  off_on: z.iso.date("Pick a date."),
  note: z
    .string()
    .trim()
    .max(120, "Keep the note under 120 characters.")
    .optional()
    .transform((value) => (value ? value : null)),
});

export async function addTimeOff(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = timeOffSchema.safeParse({
    staff_id: formData.get("staff_id"),
    off_on: formData.get("off_on"),
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

  const { error } = await supabase.from("staff_time_off").insert({
    ...parsed.data,
    profile_id: profile.id,
  });

  if (error) {
    return {
      status: "error",
      message:
        error.code === "23505" ? "That day is already off." : error.message,
    };
  }

  refresh();
  return {
    status: "success",
    message: "Day off added." + (await conflictNote(supabase)),
  };
}

export async function removeTimeOff(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("staff_time_off")
    .delete()
    .eq("id", id.data)
    .eq("profile_id", profile.id);

  refresh();
}
