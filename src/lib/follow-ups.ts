/**
 * Clients worth a WhatsApp message: recent no-shows, and regulars who are
 * overdue by their own usual gap between visits. Pure functions with no
 * database access, so they can be tested.
 */

import { clientKey } from "@/lib/analytics";
import type { BookingRow, BookingStatus } from "@/lib/supabase/database.types";

export type FollowUpBooking = Pick<
  BookingRow,
  | "id"
  | "client_name"
  | "client_contact"
  | "contact_kind"
  | "starts_at"
  | "status"
  | "service_name"
>;

export interface FollowUp {
  /** Stable for one event, so dismissing it hides it until something new happens. */
  id: string;
  kind: "no_show" | "overdue";
  clientName: string;
  /** Digits only, with country code: what wa.me expects. */
  phone: string;
  serviceName: string;
  /** The missed appointment, or the last visit. */
  at: string;
  /** For overdue clients: their usual gap and how long it has been, in days. */
  usualGapDays?: number;
  daysSince?: number;
}

const DAY = 24 * 60 * 60 * 1000;
const HAPPENED: BookingStatus[] = ["booked", "completed"];

/** No-shows older than this are left alone. */
const NO_SHOW_WINDOW_DAYS = 14;
/** Regulars quiet for longer than this have probably moved on. */
const OVERDUE_GIVE_UP_DAYS = 180;
/** Visits needed before a client has a pattern worth reading. */
const MIN_VISITS = 2;

/** wa.me wants the number as digits with the country code and no "+" or "00". */
export function whatsappDigits(contact: string): string | null {
  const digits = contact.replace(/\D/g, "").replace(/^00/, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function findFollowUps(bookings: FollowUpBooking[], now: Date): FollowUp[] {
  const nowMs = now.getTime();

  const byClient = new Map<string, FollowUpBooking[]>();
  for (const booking of bookings) {
    // Only phone contacts can be messaged on WhatsApp.
    if (booking.contact_kind !== "whatsapp") continue;
    const key = clientKey(booking.contact_kind, booking.client_contact);
    const list = byClient.get(key) ?? [];
    list.push(booking);
    byClient.set(key, list);
  }

  const followUps: FollowUp[] = [];

  for (const list of byClient.values()) {
    list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    const phone = whatsappDigits(list[0].client_contact);
    if (!phone) continue;

    // Anyone with something already booked needs no nudge.
    const hasUpcoming = list.some(
      (b) => b.status === "booked" && new Date(b.starts_at).getTime() >= nowMs,
    );
    if (hasUpcoming) continue;

    const past = list.filter((b) => new Date(b.starts_at).getTime() < nowMs);
    const last = past[past.length - 1];
    if (!last) continue;

    // The most recent thing was a missed appointment.
    if (
      last.status === "no_show" &&
      nowMs - new Date(last.starts_at).getTime() <= NO_SHOW_WINDOW_DAYS * DAY
    ) {
      followUps.push({
        id: `no_show:${last.id}`,
        kind: "no_show",
        clientName: last.client_name,
        phone,
        serviceName: last.service_name,
        at: last.starts_at,
      });
      continue;
    }

    const visits = past.filter((b) => HAPPENED.includes(b.status));
    if (visits.length < MIN_VISITS) continue;

    const times = visits.map((b) => new Date(b.starts_at).getTime());
    const gaps = times.slice(1).map((time, index) => time - times[index]);
    // The median resists one long holiday skewing the pattern.
    const sorted = [...gaps].sort((a, b) => a - b);
    const usualGap = sorted[Math.floor(sorted.length / 2)];
    if (usualGap < DAY) continue;

    const lastVisit = visits[visits.length - 1];
    const since = nowMs - times[times.length - 1];
    // Some slack before nagging: half their gap again, and at least a week.
    const dueAfter = Math.max(usualGap * 1.5, usualGap + 7 * DAY);

    if (since > dueAfter && since <= OVERDUE_GIVE_UP_DAYS * DAY) {
      followUps.push({
        id: `overdue:${lastVisit.id}`,
        kind: "overdue",
        clientName: lastVisit.client_name,
        phone,
        serviceName: lastVisit.service_name,
        at: lastVisit.starts_at,
        usualGapDays: Math.round(usualGap / DAY),
        daysSince: Math.floor(since / DAY),
      });
    }
  }

  // Missed appointments first, then whoever is most overdue.
  return followUps.sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "no_show" ? -1 : 1) ||
      (b.daysSince ?? 0) - (a.daysSince ?? 0) ||
      b.at.localeCompare(a.at),
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The message the business sends, ready for WhatsApp to open. */
export function followUpMessage(
  followUp: FollowUp,
  businessName: string,
  bookingUrl: string,
  when: string,
): string {
  const name = firstName(followUp.clientName);

  if (followUp.kind === "no_show") {
    return `Hi ${name}, we missed you at your ${followUp.serviceName} appointment on ${when}. Would you like to book a new time? You can pick one here: ${bookingUrl}\n\n${businessName}`;
  }

  return `Hi ${name}, it's been a while since your last visit to ${businessName}. Would you like to book your next ${followUp.serviceName}? You can pick a time here: ${bookingUrl}`;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
