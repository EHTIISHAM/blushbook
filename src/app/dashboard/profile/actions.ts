"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import { requireProfile } from "@/lib/profile";
import { slugSchema } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep ${label} under ${max} characters.`)
    .transform((value) => (value ? value : null))
    .nullable();

const profileSchema = z.object({
  slug: slugSchema,
  business_name: z
    .string()
    .trim()
    .min(1, "Add your business name.")
    .max(80, "Keep your business name under 80 characters."),
  instagram_handle: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@+/, ""))
    .refine((value) => value === "" || /^[A-Za-z0-9._]{1,30}$/.test(value), {
      message: "That Instagram handle has characters Instagram doesn't allow.",
    })
    .transform((value) => (value ? value : null)),
  bio: optionalText(300, "your bio"),
  timezone: z
    .string()
    .trim()
    .min(1, "Pick your timezone.")
    .refine(isKnownTimezone, { message: "That timezone isn't recognised." }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3 letter currency code, like USD."),
  deposit_link: z
    .string()
    .trim()
    .transform((value) => (value ? value : null))
    .nullable()
    .refine((value) => value === null || /^https:\/\/\S+$/i.test(value), {
      message: "Your deposit link needs to start with https://",
    }),
  no_show_policy: optionalText(500, "your policy"),
});

function isKnownTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function saveProfile(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    slug: formData.get("slug"),
    business_name: formData.get("business_name"),
    instagram_handle: formData.get("instagram_handle") ?? "",
    bio: formData.get("bio") ?? "",
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    deposit_link: formData.get("deposit_link") ?? "",
    no_show_policy: formData.get("no_show_policy") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const { slug, ...rest } = parsed.data;

  // The slug is not writable directly; it goes through a checked RPC so the
  // reserved list and the uniqueness error are handled in one place.
  if (slug !== profile.slug) {
    const { error } = await supabase.rpc("set_slug", { p_slug: slug });

    if (error) {
      return {
        status: "error",
        message:
          error.code === "23505"
            ? "Someone already has that link. Try another."
            : error.code === "23514"
              ? "That link has characters we can't use in a web address."
              : error.message,
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update(rest)
    .eq("id", profile.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/share");
  return { status: "success", message: "Profile saved." };
}

/** Stores the path returned by a successful client-side upload. */
export async function savePhotoPath(path: string | null): Promise<ActionState> {
  const parsed = z.string().trim().min(1).max(300).nullable().safeParse(path);

  if (!parsed.success) {
    return { status: "error", message: "That photo path is not valid." };
  }

  const profile = await requireProfile();

  // Only ever point at a file inside her own folder.
  if (parsed.data !== null && !parsed.data.startsWith(`${profile.id}/`)) {
    return { status: "error", message: "That photo path is not valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ photo_path: parsed.data })
    .eq("id", profile.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard/profile");
  return {
    status: "success",
    message: parsed.data ? "Photo updated." : "Photo removed.",
  };
}
