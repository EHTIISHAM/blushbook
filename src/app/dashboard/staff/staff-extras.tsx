"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";

import { addTimeOff, deleteStaff } from "./actions";

function Submit({ idle, busy, ghost = false }: { idle: string; busy: string; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`btn btn-sm ${ghost ? "btn-ghost" : ""}`}
      disabled={pending}
    >
      {pending ? busy : idle}
    </button>
  );
}

/** Book one person off for a day. Their existing bookings stay put. */
export function TimeOffForm({
  staffId,
  name,
  today,
}: {
  staffId: string;
  name: string;
  today: string;
}) {
  const [state, formAction] = useActionState(addTimeOff, IDLE);

  return (
    <form
      key={state.status === "success" ? state.message : "time-off"}
      action={formAction}
      className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end"
    >
      <input type="hidden" name="staff_id" value={staffId} />
      <div>
        <label className="label" htmlFor={`off-on-${staffId}`}>
          Date
        </label>
        <input
          id={`off-on-${staffId}`}
          name="off_on"
          type="date"
          className="field"
          min={today}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor={`off-note-${staffId}`}>
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id={`off-note-${staffId}`}
          name="note"
          className="field"
          maxLength={120}
          placeholder="Holiday, sick, training"
        />
      </div>
      <div>
        <Submit idle="Add day off" busy="Adding…" />
        <span className="sr-only"> for {name}</span>
      </div>

      {state.status === "error" && (
        <p className="text-[14px] font-semibold text-accent sm:col-span-3" role="alert">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="text-[14px] text-muted sm:col-span-3" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function DeleteStaffButton({ staffId, name }: { staffId: string; name: string }) {
  const [state, formAction] = useActionState(deleteStaff, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={staffId} />
      <button
        type="submit"
        className="text-[14px] font-semibold text-accent underline underline-offset-4"
      >
        Remove {name}
      </button>
      {state.status === "error" ? (
        <p className="hint text-accent" role="alert">
          {state.message}
        </p>
      ) : (
        <p className="hint">
          Only for someone added by mistake. Anyone with bookings is switched
          off instead, so their history stays.
        </p>
      )}
    </form>
  );
}
