"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { UsualDurationPicker } from "@/components/usual-duration-picker";
import { IDLE } from "@/lib/action-state";

import { saveUsualDuration } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm btn-ghost" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function UsualDurationForm({ value }: { value: number }) {
  const [state, formAction] = useActionState(saveUsualDuration, IDLE);

  return (
    <form action={formAction} className="card p-4">
      <fieldset className="border-0 p-0">
        <legend className="label">Usual appointment length</legend>
        <p className="hint -mt-1 mb-3">
          Any service without its own minutes uses this. Change it and they all
          move with it.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <UsualDurationPicker value={value} idPrefix="services-usual" />
          <SaveButton />
        </div>
      </fieldset>

      {state.status !== "idle" && (
        <p
          className={`mt-2 text-[14px] ${
            state.status === "error" ? "font-semibold text-rose" : "text-muted"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
