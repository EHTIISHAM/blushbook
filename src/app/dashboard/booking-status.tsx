"use client";

import { useActionState } from "react";

import { IDLE } from "@/lib/action-state";
import type { BookingStatus } from "@/lib/supabase/database.types";

import { setBookingStatus } from "./actions";

interface Choice {
  status: "booked" | "cancelled" | "no_show";
  label: string;
}

/** The buttons that make sense for a booking, given its status and time. */
function choicesFor(status: BookingStatus, isPast: boolean): Choice[] {
  if (status === "cancelled" || status === "no_show") {
    return [{ status: "booked", label: "Undo" }];
  }
  if (isPast) {
    return [
      { status: "no_show", label: "No-show" },
      { status: "cancelled", label: "Cancelled" },
    ];
  }
  return [{ status: "cancelled", label: "Cancel" }];
}

export function BookingStatusButtons({
  id,
  status,
  isPast,
  description,
}: {
  id: string;
  status: BookingStatus;
  isPast: boolean;
  /** Who and when, so screen readers can tell the rows' buttons apart. */
  description: string;
}) {
  const [state, formAction, pending] = useActionState(setBookingStatus, IDLE);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction} className="flex flex-wrap justify-end gap-2">
        <input type="hidden" name="id" value={id} />
        {choicesFor(status, isPast).map((choice) => (
          <button
            key={choice.status}
            type="submit"
            name="status"
            value={choice.status}
            disabled={pending}
            className="btn btn-ghost btn-sm"
          >
            {choice.label}
            <span className="sr-only"> {description}</span>
          </button>
        ))}
      </form>

      {state.status === "error" && (
        <p
          className="max-w-[32ch] text-right text-[13px] font-semibold text-accent"
          role="alert"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
