"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ContactKind } from "@/lib/supabase/database.types";

export interface Slot {
  startsAt: string;
}

export type SlotsResult =
  | { status: "ok"; slots: string[] }
  | { status: "error"; message: string };

export interface Confirmation {
  bookingId: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
  depositCents: number;
  currency: string;
  timezone: string;
  depositLink: string | null;
  noShowPolicy: string | null;
}

export type BookingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "booked"; confirmation: Confirmation };

export const BOOKING_IDLE: BookingState = { status: "idle" };

const SLOT_DAYS = 21;

/**
 * A stable, non-reversible handle for one visitor, used only for rate
 * limiting. The raw address never reaches the database.
 *
 * The salt keeps the hash from being a plain dictionary of the IPv4 space;
 * without one configured it still works, it is just weaker against someone
 * who already has the table.
 */
async function ipHash(): Promise<string> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    "unknown";

  const salt = process.env.RATE_LIMIT_SALT ?? "blushbook";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Open slots for one service, as ISO strings. */
export async function fetchSlots(
  slug: string,
  serviceId: string,
): Promise<SlotsResult> {
  const parsed = z
    .object({ slug: z.string().min(1).max(40), serviceId: z.uuid() })
    .safeParse({ slug, serviceId });

  if (!parsed.success) {
    return { status: "error", message: "Couldn't load times for that service." };
  }

  const supabase = await createClient();

  // Start from today in UTC. The function itself resolves days against her
  // timezone, and filters out anything too soon to book.
  const from = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_available_slots", {
    p_slug: parsed.data.slug,
    p_service_id: parsed.data.serviceId,
    p_from: from,
    p_days: SLOT_DAYS,
  });

  if (error) {
    return { status: "error", message: "Couldn't load times. Please refresh." };
  }

  return { status: "ok", slots: (data ?? []).map((row) => row.slot_start) };
}

const bookingSchema = z.object({
  slug: z.string().min(1).max(40),
  serviceId: z.uuid("Pick a service."),
  startsAt: z.iso.datetime({ offset: true }),
  clientName: z
    .string()
    .trim()
    .min(1, "Please add your name.")
    .max(80, "That name is too long."),
  clientContact: z
    .string()
    .trim()
    .min(2, "Please add a WhatsApp number or Instagram handle.")
    .max(120, "That's too long."),
  contactKind: z.enum(["whatsapp", "instagram"]),
});

export async function submitBooking(
  _previous: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const parsed = bookingSchema.safeParse({
    slug: formData.get("slug"),
    serviceId: formData.get("serviceId"),
    startsAt: formData.get("startsAt"),
    clientName: formData.get("clientName"),
    clientContact: formData.get("clientContact"),
    contactKind: formData.get("contactKind"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: parsed.data.slug,
    p_service_id: parsed.data.serviceId,
    p_starts_at: parsed.data.startsAt,
    p_client_name: parsed.data.clientName,
    p_client_contact: parsed.data.clientContact,
    p_contact_kind: parsed.data.contactKind as ContactKind,
    p_ip_hash: await ipHash(),
  });

  if (error) {
    // The function raises with messages written for clients, so pass them
    // through; anything else gets a generic line rather than a Postgres error.
    const friendly =
      error.code === "P0001" || error.code === "P0002"
        ? error.message
        : "Something went wrong. Please try again.";
    return { status: "error", message: friendly };
  }

  const row = data?.[0];
  if (!row) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return {
    status: "booked",
    confirmation: {
      bookingId: row.booking_id,
      businessName: row.business_name,
      serviceName: row.service_name,
      startsAt: row.starts_at,
      depositCents: row.deposit_cents,
      currency: row.currency,
      timezone: row.timezone,
      depositLink: row.deposit_link,
      noShowPolicy: row.no_show_policy,
    },
  };
}
