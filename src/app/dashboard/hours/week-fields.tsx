"use client";

import { useState } from "react";

import { minutesToTimeValue, WEEKDAYS } from "@/lib/format";
import type { DayWindow } from "@/lib/week";

export type { DayWindow };

/** Monday first reads better, but the values stay 0 = Sunday to match the DB. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DEFAULT_START = 9 * 60;
const DEFAULT_END = 17 * 60;

/**
 * Seven rows of "open? from – to". Used for business hours and for each staff
 * member's own hours; parseWeek in lib/week reads the fields back.
 */
export function WeekFields({
  initial,
  prefix = "",
  closedLabel = "Closed",
}: {
  initial: Record<number, DayWindow | undefined>;
  /** Keeps field names unique when more than one week is on the page. */
  prefix?: string;
  closedLabel?: string;
}) {
  const [openDays, setOpenDays] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      DISPLAY_ORDER.map((weekday) => [weekday, Boolean(initial[weekday])]),
    ),
  );

  return (
    <div className="grid gap-3">
      {DISPLAY_ORDER.map((weekday) => {
        const day = initial[weekday];
        const isOpen = openDays[weekday] ?? false;

        return (
          <div
            key={weekday}
            className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 rounded-[18px] px-1 py-2 sm:grid-cols-[150px_minmax(0,1fr)]"
          >
            <label className="flex items-center gap-3 text-[15px] font-semibold">
              <input
                type="checkbox"
                name={`${prefix}open-${weekday}`}
                checked={isOpen}
                onChange={(event) =>
                  setOpenDays((previous) => ({
                    ...previous,
                    [weekday]: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-[var(--accent)]"
              />
              {WEEKDAYS[weekday]}
            </label>

            {isOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  name={`${prefix}start-${weekday}`}
                  className="field w-[9.5rem]"
                  defaultValue={minutesToTimeValue(
                    day?.start_minute ?? DEFAULT_START,
                  )}
                  aria-label={`${WEEKDAYS[weekday]} start time`}
                  required
                />
                <span className="text-muted">to</span>
                <input
                  type="time"
                  name={`${prefix}end-${weekday}`}
                  className="field w-[9.5rem]"
                  defaultValue={minutesToTimeValue(
                    day?.end_minute ?? DEFAULT_END,
                  )}
                  aria-label={`${WEEKDAYS[weekday]} finish time`}
                  required
                />
              </div>
            ) : (
              <span className="text-[15px] text-muted">{closedLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
