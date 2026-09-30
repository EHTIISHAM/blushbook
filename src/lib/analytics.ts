/**
 * Business numbers for the Analytics tab, worked out from bookings, hours and
 * days off. Pure functions with no database access, so they can be tested.
 *
 * A past booking still marked "booked" counts as having happened: she only
 * marks the ones that went wrong (see the Bookings tab).
 */

import type { BookingRow, BookingStatus } from "@/lib/supabase/database.types";

export type AnalyticsBooking = Pick<
  BookingRow,
  | "client_name"
  | "client_contact"
  | "contact_kind"
  | "starts_at"
  | "ends_at"
  | "status"
  | "service_name"
  | "price_cents"
>;

export interface Window {
  weekday: number;
  start_minute: number;
  end_minute: number;
}

export interface AnalyticsInput {
  /** Every booking she has, any status, any date. */
  bookings: AnalyticsBooking[];
  availability: Window[];
  /** YYYY-MM-DD dates she took off. */
  blockedDates: string[];
  timezone: string;
  /** Start of the period being reported. */
  from: Date;
  now: Date;
  /** A client is lapsed when their last visit is older than this. */
  lapsedAfterDays: number;
}

export interface ServiceStat {
  name: string;
  bookings: number;
  revenueCents: number;
}

export interface LapsedClient {
  name: string;
  contact: string;
  contactKind: BookingRow["contact_kind"];
  lastVisit: string;
  visits: number;
}

export interface Slot {
  weekday: number;
  hour: number;
  bookings: number;
}

export interface Analytics {
  revenueCents: number;
  /** Bookings that happened in the period. */
  bookings: number;
  clients: number;
  averageSpendCents: number | null;
  services: ServiceStat[];
  /** Bookings that happened, by weekday (0 = Sunday). */
  byWeekday: number[];
  /** Bookings that happened, by hour of day they started (0-23). */
  byHour: number[];
  /** Bookings that happened, [weekday][hour]. */
  byWeekdayHour: number[][];
  /** Most bookings; null when there were none. */
  busiestSlot: Slot | null;
  /** Fewest bookings among the hours she is open; null when she has no hours. */
  quietestSlot: Slot | null;
  noShows: number;
  /** No-shows out of the bookings that were due to happen. */
  noShowRate: number | null;
  cancellations: number;
  /** Cancellations out of all bookings in the period. */
  cancellationRate: number | null;
  newClients: number;
  returningClients: number;
  /** Clients in the period who have visited two or more times in total. */
  repeatRate: number | null;
  openMinutes: number;
  bookedMinutes: number;
  utilisation: number | null;
  emptyMinutes: number;
  /** Empty time valued at what an hour of her booked time actually earned. */
  estimatedLostCents: number | null;
  lapsed: LapsedClient[];
}

const HAPPENED: BookingStatus[] = ["booked", "completed"];

/**
 * Who a booking belongs to. Clients have no accounts, so the contact they
 * typed is the best identity there is: the same person giving a different
 * number shows up as two clients.
 */
export function clientKey(
  kind: BookingRow["contact_kind"],
  contact: string,
): string {
  const value =
    kind === "whatsapp"
      ? contact.replace(/\D/g, "")
      : contact.trim().toLowerCase().replace(/^@/, "");
  return `${kind}:${value}`;
}

/** YYYY-MM-DD, weekday and hour for an instant, read in her timezone. */
function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      get("weekday"),
    ),
    hour: Number(get("hour")),
  };
}

/** Every calendar day from `first` to `last` inclusive, as YYYY-MM-DD. */
function daysBetween(first: string, last: string): string[] {
  const days: string[] = [];
  const [y, m, d] = first.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  const end = last;

  while (cursor.toISOString().slice(0, 10) <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Whether her weekly hours cover the whole of this hour. */
function isOpenAt(windows: Window[], weekday: number, hour: number): boolean {
  return windows.some(
    (w) =>
      w.weekday === weekday &&
      w.start_minute <= hour * 60 &&
      w.end_minute >= (hour + 1) * 60,
  );
}

function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function computeAnalytics(input: AnalyticsInput): Analytics {
  const { bookings, timezone, from, now } = input;
  const fromMs = from.getTime();
  const nowMs = now.getTime();

  // Only bookings whose time has come: the future can't have happened yet.
  const inPeriod = bookings.filter((booking) => {
    const start = new Date(booking.starts_at).getTime();
    return start >= fromMs && start < nowMs;
  });
  const happened = inPeriod.filter((b) => HAPPENED.includes(b.status));

  const revenueCents = happened.reduce((sum, b) => sum + b.price_cents, 0);

  // Services, most booked first.
  const serviceMap = new Map<string, ServiceStat>();
  for (const booking of happened) {
    const stat = serviceMap.get(booking.service_name) ?? {
      name: booking.service_name,
      bookings: 0,
      revenueCents: 0,
    };
    stat.bookings += 1;
    stat.revenueCents += booking.price_cents;
    serviceMap.set(booking.service_name, stat);
  }
  const services = [...serviceMap.values()].sort(
    (a, b) => b.bookings - a.bookings || b.revenueCents - a.revenueCents,
  );

  const byWeekday = Array<number>(7).fill(0);
  const byHour = Array<number>(24).fill(0);
  const byWeekdayHour = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const booking of happened) {
    const local = localParts(new Date(booking.starts_at), timezone);
    const hour = local.hour % 24;
    byHour[hour] += 1;
    if (local.weekday >= 0) {
      byWeekday[local.weekday] += 1;
      byWeekdayHour[local.weekday][hour] += 1;
    }
  }

  let busiestSlot: Slot | null = null;
  let quietestSlot: Slot | null = null;
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const count = byWeekdayHour[weekday][hour];
      if (count > 0 && (!busiestSlot || count > busiestSlot.bookings)) {
        busiestSlot = { weekday, hour, bookings: count };
      }
      if (
        isOpenAt(input.availability, weekday, hour) &&
        (!quietestSlot || count < quietestSlot.bookings)
      ) {
        quietestSlot = { weekday, hour, bookings: count };
      }
    }
  }

  const noShows = inPeriod.filter((b) => b.status === "no_show").length;
  const cancellations = inPeriod.filter((b) => b.status === "cancelled").length;

  // Clients: every visit ever, so "new" and "repeat" look beyond the period.
  const visitsByClient = new Map<string, AnalyticsBooking[]>();
  for (const booking of bookings) {
    if (!HAPPENED.includes(booking.status)) continue;
    if (new Date(booking.starts_at).getTime() >= nowMs) continue;

    const key = clientKey(booking.contact_kind, booking.client_contact);
    const visits = visitsByClient.get(key) ?? [];
    visits.push(booking);
    visitsByClient.set(key, visits);
  }
  for (const visits of visitsByClient.values()) {
    visits.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  const clientsInPeriod = new Set(
    happened.map((b) => clientKey(b.contact_kind, b.client_contact)),
  );

  let newClients = 0;
  let repeatClients = 0;
  for (const key of clientsInPeriod) {
    const visits = visitsByClient.get(key) ?? [];
    if (visits.length > 0 && new Date(visits[0].starts_at).getTime() >= fromMs) {
      newClients += 1;
    }
    if (visits.length >= 2) repeatClients += 1;
  }

  const lapsedBefore = nowMs - input.lapsedAfterDays * 24 * 60 * 60 * 1000;
  const lapsed: LapsedClient[] = [];
  for (const visits of visitsByClient.values()) {
    const last = visits[visits.length - 1];
    if (new Date(last.starts_at).getTime() >= lapsedBefore) continue;

    // A client with something booked in the future isn't lapsed.
    const key = clientKey(last.contact_kind, last.client_contact);
    const hasUpcoming = bookings.some(
      (b) =>
        b.status === "booked" &&
        new Date(b.starts_at).getTime() >= nowMs &&
        clientKey(b.contact_kind, b.client_contact) === key,
    );
    if (hasUpcoming) continue;

    lapsed.push({
      name: last.client_name,
      contact: last.client_contact,
      contactKind: last.contact_kind,
      lastVisit: last.starts_at,
      visits: visits.length,
    });
  }
  // Loyal clients first: they're the ones most worth a message.
  lapsed.sort(
    (a, b) => b.visits - a.visits || b.lastVisit.localeCompare(a.lastVisit),
  );

  // Open time: her current weekly hours laid over each day of the period,
  // minus days off. Changing her hours later rewrites this history, which is
  // an accepted limit — past hours aren't stored.
  const minutesByWeekday = Array<number>(7).fill(0);
  for (const window of input.availability) {
    minutesByWeekday[window.weekday] += window.end_minute - window.start_minute;
  }
  const blocked = new Set(input.blockedDates);
  const firstDay = localParts(from, timezone).day;
  // Today is left out: its remaining hours haven't had a chance to fill.
  const lastDay = localParts(new Date(nowMs - 24 * 60 * 60 * 1000), timezone).day;

  let openMinutes = 0;
  for (const day of daysBetween(firstDay, lastDay)) {
    if (blocked.has(day)) continue;
    const [y, m, d] = day.split("-").map(Number);
    openMinutes += minutesByWeekday[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  }

  const beforeToday = happened.filter(
    (b) => localParts(new Date(b.starts_at), timezone).day <= lastDay,
  );
  const bookedMinutes = beforeToday.reduce(
    (sum, b) =>
      sum +
      (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000,
    0,
  );
  const bookedRevenueCents = beforeToday.reduce(
    (sum, b) => sum + b.price_cents,
    0,
  );

  const emptyMinutes = Math.max(0, openMinutes - bookedMinutes);
  const earnedPerMinute =
    bookedMinutes > 0 ? bookedRevenueCents / bookedMinutes : null;

  return {
    revenueCents,
    bookings: happened.length,
    clients: clientsInPeriod.size,
    averageSpendCents:
      clientsInPeriod.size > 0
        ? Math.round(revenueCents / clientsInPeriod.size)
        : null,
    services,
    byWeekday,
    byHour,
    byWeekdayHour,
    busiestSlot,
    quietestSlot,
    noShows,
    noShowRate: rate(noShows, happened.length + noShows),
    cancellations,
    cancellationRate: rate(cancellations, inPeriod.length),
    newClients,
    returningClients: clientsInPeriod.size - newClients,
    repeatRate: rate(repeatClients, clientsInPeriod.size),
    openMinutes,
    bookedMinutes,
    utilisation:
      openMinutes > 0 ? Math.min(1, bookedMinutes / openMinutes) : null,
    emptyMinutes,
    estimatedLostCents:
      earnedPerMinute === null
        ? null
        : Math.round(emptyMinutes * earnedPerMinute),
    lapsed,
  };
}

export type TrendUnit = "day" | "week" | "month";

export interface TrendPoint {
  /** YYYY-MM-DD the bucket starts on, in her timezone. */
  start: string;
  bookings: number;
}

/**
 * Bookings that happened, counted per day, week (starting Monday) or month
 * across [from, now). Empty buckets are kept so gaps show as zero.
 */
export function bookingsTrend(
  bookings: AnalyticsBooking[],
  timezone: string,
  from: Date,
  now: Date,
  unit: TrendUnit,
): TrendPoint[] {
  const bucketOf = (day: string): string => {
    if (unit === "month") return `${day.slice(0, 8)}01`;
    if (unit === "day") return day;
    const [y, m, d] = day.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  };

  const counts = new Map<string, number>();
  for (const day of daysBetween(
    localParts(from, timezone).day,
    localParts(now, timezone).day,
  )) {
    counts.set(bucketOf(day), 0);
  }

  const fromMs = from.getTime();
  const nowMs = now.getTime();
  for (const booking of bookings) {
    if (!HAPPENED.includes(booking.status)) continue;
    const start = new Date(booking.starts_at).getTime();
    if (start < fromMs || start >= nowMs) continue;

    const key = bucketOf(localParts(new Date(start), timezone).day);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts].map(([start, count]) => ({ start, bookings: count }));
}
