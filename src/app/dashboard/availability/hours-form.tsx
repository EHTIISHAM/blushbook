"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";

import { saveHours } from "./actions";
import { WeekFields, type DayWindow } from "./week-fields";

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

  return (
    <form action={formAction} className="mt-6 grid gap-3">
      <WeekFields initial={initial} />

      {state.status === "error" && (
        <p className="text-[14px] font-semibold text-accent" role="alert">
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
