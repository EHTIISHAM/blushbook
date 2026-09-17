/** Formatting shared by the dashboard and the public booking page. */

export function formatMoney(
  cents: number,
  currency: string,
  locale = "en-US",
): string {
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    // An unknown currency code should not take the page down.
    return `${currency} ${(cents / 100).toFixed(whole ? 0 : 2)}`;
  }
}

/** Cents to a plain decimal string for a number input: 7500 -> "75.00". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

/** Minutes from midnight to a 24 hour value an <input type="time"> accepts. */
export function minutesToTimeValue(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** "13:30" -> 810. Returns null when the value is not a valid time. */
export function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** Minutes from midnight to something readable: 630 -> "10:30am". */
export function minutesToLabel(minutes: number): string {
  const total = minutes % 1440;
  const hours24 = Math.floor(total / 60);
  const rest = total % 60;
  const suffix = hours24 < 12 ? "am" : "pm";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  // 1440 means "end of day", which reads better as midnight.
  if (minutes === 1440) return "12:00am";

  return `${hours12}:${String(rest).padStart(2, "0")}${suffix}`;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
