/**
 * Shapes shared between the booking form and its server actions.
 *
 * These live outside actions.ts deliberately: a "use server" module may only
 * export async functions, so a plain constant like BOOKING_IDLE cannot live
 * there even though types can.
 */

export type SlotsResult =
  | { status: "ok"; slots: string[] }
  | { status: "error"; message: string };

export interface Confirmation {
  bookingIds: string[];
  businessName: string;
  /** In the order they happen. */
  serviceNames: string[];
  /** Who they're booked with; shown only when the business has several. */
  staffName: string;
  startsAt: string;
  endsAt: string;
  totalCents: number;
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
