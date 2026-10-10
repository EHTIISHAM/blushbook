"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";
import {
  MenuScanUnavailable,
  scanMenuPhotos,
  type MenuPhoto,
} from "@/lib/menu-scan";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { SWATCHES } from "@/lib/swatches";
import {
  SECTOR_DEFAULTS,
  isSector,
  suggestTiming,
  type Confidence,
  type Sector,
  type TimingSource,
} from "@/lib/timing-rules";

/** Prices arrive as decimal currency and are stored as whole cents. */
const money = z
  .coerce.number<number>()
  .min(0, "Must be zero or more.")
  .max(100000, "That's higher than this form allows.")
  .transform((value) => Math.round(value * 100));

const minutes = z.coerce
  .number<number>()
  .int("Use whole minutes.")
  .min(5, "Minimum is 5 minutes.")
  .max(1440, "Maximum is 24 hours.");

const bufferMinutes = z.coerce
  .number<number>()
  .int("Use whole minutes for the buffer.")
  .min(0, "The buffer can't be negative.")
  .max(240, "Keep the buffer under 4 hours.");

const SLOT_STEPS = [5, 10, 15, 20, 30, 60] as const;

const serviceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give the service a name.")
      .max(80, "Keep the name under 80 characters."),
    // Blank means "my usual length"; the database fills in the number.
    duration_minutes: minutes.nullable(),
    buffer_minutes: bufferMinutes,
    price_cents: money,
    // Deposits are switched off for now: clients pay at the business.
    // deposit_cents: money,
    swatch: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour."),
    is_active: z.boolean(),
  });
// .refine((value) => value.deposit_cents <= value.price_cents, {
//   message: "The deposit can't be more than the price.",
//   path: ["deposit_cents"],
// });

function parseService(formData: FormData) {
  const duration = String(formData.get("duration_minutes") ?? "").trim();

  return serviceSchema.safeParse({
    name: formData.get("name"),
    duration_minutes: duration || null,
    buffer_minutes: String(formData.get("buffer_minutes") ?? "").trim() || 0,
    price_cents: formData.get("price"),
    // deposit_cents: formData.get("deposit"),
    swatch: formData.get("swatch"),
    is_active: formData.get("is_active") === "on",
  });
}

type ParsedService = z.infer<typeof serviceSchema>;

/** A blank length becomes "follow my usual length". Saving the form counts
 *  as her checking the timing, so any review flag is cleared. */
function toRow(service: ParsedService, usualMinutes: number) {
  const { duration_minutes, ...rest } = service;
  return {
    ...rest,
    duration_is_default: duration_minutes === null,
    duration_minutes: duration_minutes ?? usualMinutes,
    timing_review_note: null,
  };
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
    ...toRow(parsed.data, profile.default_duration_minutes),
    profile_id: profile.id,
    slot_step_minutes: profile.business_sector
      ? SECTOR_DEFAULTS[profile.business_sector].step
      : 15,
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
    .update(toRow(parsed.data, profile.default_duration_minutes), {
      count: "exact",
    })
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

/** She has looked at a suggested timing and it's right as it is. */
export async function confirmServiceTiming(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase
    .from("services")
    .update({ timing_review_note: null })
    .eq("id", id.data)
    .eq("profile_id", profile.id);

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/settings/share");
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

/* -------------------------------------------------------------------------
   Her usual appointment length
   ------------------------------------------------------------------------- */

export async function saveUsualDuration(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = minutes.safeParse(formData.get("default_duration_minutes"));
  if (!parsed.success) {
    return { status: "error", message: firstIssue(parsed.error) };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  // A trigger moves every service that follows the usual length with it.
  const { error } = await supabase
    .from("profiles")
    .update({ default_duration_minutes: parsed.data })
    .eq("id", profile.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/settings/profile");
  return { status: "success", message: "Saved." };
}

/* -------------------------------------------------------------------------
   Menu scanning
   ------------------------------------------------------------------------- */
// Scanning only reads the photo and hands back a draft. Nothing is written
// until she has looked it over and pressed import.

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_PHOTOS = 4;
// Claude's per-image ceiling. The browser shrinks photos well below this
// before upload; this only catches a client that skipped that step.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export interface ScannedService {
  section: string;
  name: string;
  /** Decimal currency as typed into a price field, e.g. "25.00". */
  price: string;
  /** What the menu said when it wasn't one fixed price. */
  priceNote: string | null;
  /** Null means "use my usual length". */
  minutes: number | null;
  buffer: number;
  step: number;
  confidence: Confidence;
  source: TimingSource;
  /** The rulebook service the timing was taken from. */
  ruleName: string | null;
  /** Why she should check this timing before clients book it. */
  review: string | null;
  /** A service with this name is already on her list. */
  duplicate: boolean;
}

export type ScanState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      services: ScannedService[];
      /** Set when the menu's prices look like another currency. */
      menuCurrency: string | null;
    };

export async function scanMenu(
  _previous: ScanState,
  formData: FormData,
): Promise<ScanState> {
  const files = formData
    .getAll("photo")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return { status: "error", message: "Add a photo of your menu first." };
  }
  if (files.length > MAX_PHOTOS) {
    return {
      status: "error",
      message: `Up to ${MAX_PHOTOS} photos at a time.`,
    };
  }
  for (const file of files) {
    if (!PHOTO_TYPES.includes(file.type)) {
      return { status: "error", message: "Use a JPG, PNG or WebP photo." };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { status: "error", message: "That photo is too large." };
    }
  }

  const rawSector = String(formData.get("sector") ?? "");
  const sector: Sector | null = isSector(rawSector) ? rawSector : null;

  const profile = await requireProfile();
  const supabase = await createClient();

  // Remembered on her profile so the next scan, and services she adds by
  // hand, start from the same rulebook rows.
  if (sector !== profile.business_sector) {
    await supabase
      .from("profiles")
      .update({ business_sector: sector })
      .eq("id", profile.id);
  }

  const photos: MenuPhoto[] = await Promise.all(
    files.map(async (file) => ({
      mediaType: file.type as MenuPhoto["mediaType"],
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    })),
  );

  let menu;
  try {
    menu = await scanMenuPhotos(photos);
  } catch (error) {
    if (error instanceof MenuScanUnavailable) {
      return { status: "error", message: error.message };
    }
    console.error("Menu scan failed", error);
    return {
      status: "error",
      message:
        "We couldn't read that photo. Try again with the whole menu in frame and in focus.",
    };
  }

  const { data: existing } = await supabase
    .from("services")
    .select("name")
    .eq("profile_id", profile.id);

  const taken = new Set(
    (existing ?? []).map((service) => service.name.trim().toLowerCase()),
  );

  const services = menu.items
    .map((item): ScannedService => {
      const name = item.name.trim().slice(0, 80);
      const section = item.section.trim();
      const length = item.duration_minutes;
      const timing = suggestTiming({
        name,
        section,
        statedMinutes:
          length !== null &&
          Number.isInteger(length) &&
          length >= 5 &&
          length <= 1440
            ? length
            : null,
        sector,
        usualMinutes: profile.default_duration_minutes,
      });

      return {
        section,
        name,
        price:
          item.price !== null && item.price >= 0 ? item.price.toFixed(2) : "",
        priceNote: item.price_note?.trim() || null,
        ...timing,
        duplicate: taken.has(name.toLowerCase()),
      };
    })
    .filter((service) => service.name.length > 0);

  if (services.length === 0) {
    return {
      status: "error",
      message: "We couldn't find any services in that photo.",
    };
  }

  const menuCurrency = menu.currency?.trim().toUpperCase() || null;

  return {
    status: "success",
    services,
    menuCurrency:
      menuCurrency && menuCurrency !== profile.currency ? menuCurrency : null,
  };
}

const importSchema = z
  .array(
    z.object({
      section: z.string().trim().max(80),
      name: z
        .string()
        .trim()
        .min(1, "Every service needs a name")
        .max(80, "Keep names under 80 characters"),
      // Plain JSON numbers here: coercing would turn a blank price into 0.
      price_cents: z
        .number({ error: "Add a price" })
        .min(0, "Prices must be zero or more")
        .max(100000, "That price is higher than this form allows")
        .transform((value) => Math.round(value * 100)),
      duration_minutes: z
        .number()
        .int("Use whole minutes")
        .min(5, "Minimum is 5 minutes")
        .max(1440, "Maximum is 24 hours")
        .nullable(),
      buffer_minutes: z
        .number()
        .int("Use whole minutes for the buffer")
        .min(0, "The buffer can't be negative")
        .max(240, "Keep the buffer under 4 hours"),
      slot_step_minutes: z.union(SLOT_STEPS.map((step) => z.literal(step))),
      timing_review_note: z.string().trim().max(300).nullable(),
    }),
  )
  .min(1, "Tick at least one service to add")
  .max(200, "That's more services than one import allows");

export async function importServices(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("services") ?? "[]"));
  } catch {
    return { status: "error", message: "Check the list and try again." };
  }

  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Name the service rather than a row number she can't see.
    const index = issue?.path[0];
    const named =
      typeof index === "number" && Array.isArray(raw)
        ? (raw[index] as { name?: unknown } | undefined)?.name
        : undefined;
    const where =
      typeof named === "string" && named.trim() ? ` for ${named.trim()}` : "";
    return {
      status: "error",
      message: issue ? `${issue.message}${where}.` : "Check the list and try again.",
    };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("services")
    .select("sort_order")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const start = (last?.sort_order ?? -1) + 1;

  // One colour per menu section, so related services read as a group.
  const sections = [...new Set(parsed.data.map((service) => service.section))];

  const { error } = await supabase.from("services").insert(
    parsed.data.map(({ section, duration_minutes, ...service }, index) => ({
      ...service,
      profile_id: profile.id,
      deposit_cents: 0,
      timing_review_note: service.timing_review_note || null,
      duration_is_default: duration_minutes === null,
      duration_minutes: duration_minutes ?? profile.default_duration_minutes,
      swatch: SWATCHES[sections.indexOf(section) % SWATCHES.length],
      is_active: true,
      sort_order: start + index,
    })),
  );

  if (error) {
    return { status: "error", message: error.message };
  }

  const count = parsed.data.length;
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/settings/share");
  revalidatePath("/welcome");
  return {
    status: "success",
    message: `${count} service${count === 1 ? "" : "s"} added.`,
  };
}
