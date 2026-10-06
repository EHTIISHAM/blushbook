import { timeValueToMinutes, WEEKDAYS } from "@/lib/format";

/** One open stretch on one weekday, in minutes from midnight. */
export interface WeekWindow {
  weekday: number;
  start_minute: number;
  end_minute: number;
}

export type ParsedWeek =
  | { ok: true; windows: WeekWindow[] }
  | { ok: false; message: string };

/**
 * Reads the fields WeekFields renders (open-N, start-N, end-N) back into
 * windows. Shared by business hours and staff hours so both check the same
 * things in the same words.
 */
export function parseWeek(formData: FormData, prefix = ""): ParsedWeek {
  const windows: WeekWindow[] = [];

  for (let weekday = 0; weekday < WEEKDAYS.length; weekday += 1) {
    if (formData.get(`${prefix}open-${weekday}`) !== "on") continue;

    const start = timeValueToMinutes(
      String(formData.get(`${prefix}start-${weekday}`) ?? ""),
    );
    const end = timeValueToMinutes(
      String(formData.get(`${prefix}end-${weekday}`) ?? ""),
    );

    if (start === null || end === null) {
      return {
        ok: false,
        message: `Add a start and finish time for ${WEEKDAYS[weekday]}.`,
      };
    }

    if (end <= start) {
      return {
        ok: false,
        message: `${WEEKDAYS[weekday]} finishes before it starts.`,
      };
    }

    windows.push({ weekday, start_minute: start, end_minute: end });
  }

  return { ok: true, windows };
}

/** One day's hours as the week editor shows them. */
export interface DayWindow {
  start_minute: number;
  end_minute: number;
}

/** The editor shows one window per day, so keep the earliest of each. */
export function firstWindowPerDay(
  rows: { weekday: number; start_minute: number; end_minute: number }[],
): Record<number, DayWindow | undefined> {
  const days: Record<number, DayWindow | undefined> = {};
  for (const row of [...rows].sort((a, b) => a.start_minute - b.start_minute)) {
    if (!days[row.weekday]) {
      days[row.weekday] = {
        start_minute: row.start_minute,
        end_minute: row.end_minute,
      };
    }
  }
  return days;
}
