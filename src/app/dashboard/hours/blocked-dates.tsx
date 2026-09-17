"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";

import { blockDate } from "./actions";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm" disabled={pending}>
      {pending ? "Blocking…" : "Block date"}
    </button>
  );
}

export function BlockDateForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(blockDate, IDLE);

  // Remounting after a success clears the fields.
  return (
    <form
      key={state.status === "success" ? state.message : "block-form"}
      action={formAction}
      className="mt-5 grid gap-3"
    >
      <div>
        <label className="label" htmlFor="blocked_on">
          Date
        </label>
        <input
          id="blocked_on"
          name="blocked_on"
          type="date"
          className="field"
          min={today}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="note">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="note"
          name="note"
          className="field"
          maxLength={120}
          placeholder="Eid, travelling, fully booked"
        />
      </div>

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

      <div>
        <AddButton />
      </div>
    </form>
  );
}
