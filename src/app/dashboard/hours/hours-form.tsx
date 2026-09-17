"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";
import { minutesToTimeValue, WEEKDAYS } from "@/lib/format";

import { saveHours } from "./actions";

export interface DayWindow {
  start_minute: number;
  end_minute: number;
}

/** Monday first reads better, but the values stay 0 = Sunday to match the DB. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DEFAULT_START = 9 * 60;
const DEFAULT_END = 17 * 60;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Saving…" : "Save hours"}
    </button>
  );
}

export function HoursForm({
  initial,
}: {
  initial: Record<number, DayWindow | undefined>;
}) {
  const [state, formAction] = useActionState(saveHours, IDLE);
  const [openDays, setOpenDays] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      DISPLAY_ORDER.map((weekday) => [weekday, Boolean(initial[weekday])]),
    ),
  );

  return (
    <form action={formAction} className="mt-6 grid gap-3">
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
                name={`open-${weekday}`}
                checked={isOpen}
                onChange={(event) =>
                  setOpenDays((previous) => ({
                    ...previous,
                    [weekday]: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-[var(--cherry)]"
              />
              {WEEKDAYS[weekday]}
            </label>

            {isOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  name={`start-${weekday}`}
                  className="field w-[9.5rem]"
                  defaultValue={minutesToTimeValue(
                    day?.start_minute ?? DEFAULT_START,
                  )}
                  aria-label={`${WEEKDAYS[weekday]} opening time`}
                  required
                />
                <span className="text-muted">to</span>
                <input
                  type="time"
                  name={`end-${weekday}`}
                  className="field w-[9.5rem]"
                  defaultValue={minutesToTimeValue(
                    day?.end_minute ?? DEFAULT_END,
                  )}
                  aria-label={`${WEEKDAYS[weekday]} closing time`}
                  required
                />
              </div>
            ) : (
              <span className="text-[15px] text-muted">Closed</span>
            )}
          </div>
        );
      })}

      {state.status === "error" && (
        <p className="text-[14px] font-semibold text-cherry" role="alert">
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <p className="text-[14px] text-muted" role="status">
          {state.message}
        </p>
      )}

      <div className="mt-2">
        <SaveButton />
      </div>
    </form>
  );
}
