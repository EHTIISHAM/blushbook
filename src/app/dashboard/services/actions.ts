"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/** Prices arrive as decimal currency and are stored as whole cents. */
const money = z
  .coerce.number<number>()
  .min(0, "Must be zero or more.")
  .max(100000, "That's higher than this form allows.")
  .transform((value) => Math.round(value * 100));

const serviceSchema = z
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
    deposit_cents: money,
    swatch: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour."),
    is_active: z.boolean(),
  })
  .refine((value) => value.deposit_cents <= value.price_cents, {
    message: "The deposit can't be more than the price.",
    path: ["deposit_cents"],
  });

function parseService(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    duration_minutes: formData.get("duration_minutes"),
    price_cents: formData.get("price"),
    deposit_cents: formData.get("deposit"),
    swatch: formData.get("swatch"),
    is_active: formData.get("is_active") === "on",
  });
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function createService(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseService(formData);
  if (!parsed.success) {
    return { status: "error", message: firstIssue(parsed.error) };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  // New services go to the bottom of her list.
  const { data: last } = await supabase
    .from("services")
    .select("sort_order")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("services").insert({
    ...parsed.data,
    profile_id: profile.id,
    sort_order: (last?.sort_order ?? -1) + 1,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard/services");
  return { status: "success", message: `${parsed.data.name} added.` };
}

export async function updateService(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) {
    return { status: "error", message: "That service no longer exists." };
  }

  const parsed = parseService(formData);
  if (!parsed.success) {
    return { status: "error", message: firstIssue(parsed.error) };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  // profile_id is redundant next to RLS, but it keeps a mistyped id from
  // silently matching nothing and reporting success.
  const { error, count } = await supabase
    .from("services")
    .update(parsed.data, { count: "exact" })
    .eq("id", id.data)
    .eq("profile_id", profile.id);

  if (error) {
    return { status: "error", message: error.message };
  }
  if (!count) {
    return { status: "error", message: "That service no longer exists." };
  }

  revalidatePath("/dashboard/services");
  return { status: "success", message: "Saved." };
}

export async function deleteService(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("services")
    .delete()
    .eq("id", id.data)
    .eq("profile_id", profile.id);

  revalidatePath("/dashboard/services");
}

export async function moveService(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  const direction = formData.get("direction");
  if (!id.success || (direction !== "up" && direction !== "down")) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("id, sort_order")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!services) return;

  const index = services.findIndex((service) => service.id === id.data);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= services.length) return;

  // Rewrite the whole column so historic ties in sort_order settle into a
  // clean 0..n-1 order instead of leaving two rows sharing a position.
  const reordered = [...services];
  [reordered[index], reordered[swapWith]] = [
    reordered[swapWith],
    reordered[index],
  ];

  await Promise.all(
    reordered.map((service, position) =>
      supabase
        .from("services")
        .update({ sort_order: position })
        .eq("id", service.id)
        .eq("profile_id", profile.id),
    ),
  );

  revalidatePath("/dashboard/services");
}
