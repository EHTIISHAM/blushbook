"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.object({
  id: z.uuid(),
  // "completed" is never set by hand: a past booking left as "booked" counts
  // as done, so she only has to mark the ones that went wrong.
  status: z.enum(["booked", "cancelled", "no_show"]),
});

export async function setBookingStatus(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Something went wrong. Try again." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("starts_at")
    .eq("id", parsed.data.id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!booking) {
    return { status: "error", message: "That booking no longer exists." };
  }

  if (
    parsed.data.status === "no_show" &&
    new Date(booking.starts_at).getTime() > Date.now()
  ) {
    return {
      status: "error",
      message: "A booking can only be a no-show once it has started.",
    };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("profile_id", profile.id);

  if (error) {
    // 23P01 is bookings_no_overlap: someone else took the slot after this
    // booking freed it.
    return {
      status: "error",
      message:
        error.code === "23P01"
          ? "Someone else has booked that time since, so this can't be restored."
          : error.message,
    };
  }

  revalidatePath("/dashboard");
  return { status: "success" };
}
