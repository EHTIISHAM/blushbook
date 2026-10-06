"use client";

import { useActionState } from "react";

import { IDLE } from "@/lib/action-state";

import { reassignBooking } from "./actions";

/** "Move to: [Sana ▾] Move" for one upcoming booking. */
export function ReassignForm({
  id,
  currentStaffId,
  staff,
  description,
}: {
  id: string;
  currentStaffId: string;
  staff: { id: string; name: string }[];
  /** Who and when, so screen readers can tell the rows apart. */
  description: string;
}) {
  const [state, formAction, pending] = useActionState(reassignBooking, IDLE);
  const others = staff.filter((member) => member.id !== currentStaffId);

  if (others.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`move-${id}`}>
        Move {description} to
      </label>
      <select
        id={`move-${id}`}
        name="staff_id"
        className="field !w-auto !py-1.5 text-[13px]"
        defaultValue=""
        required
      >
        <option value="" disabled>
          Move to…
        </option>
        {others.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
        {pending ? "Moving…" : "Move"}
      </button>

      {state.status === "error" && (
        <p
          className="w-full max-w-[32ch] text-right text-[13px] font-semibold text-accent"
          role="alert"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
