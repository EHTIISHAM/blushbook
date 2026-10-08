"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";

import { openBillingPortal } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-ghost btn-sm mt-4" disabled={pending}>
      {pending ? "One moment…" : "Manage billing"}
    </button>
  );
}

/** Opens Stripe's hosted page: card, invoices, switch plan, cancel. */
export function ManageBilling() {
  const [state, formAction] = useActionState(() => openBillingPortal(), IDLE);

  return (
    <form action={formAction}>
      <Submit />
      {state.status === "error" && (
        <p className="mt-3 rounded-[14px] bg-notice px-4 py-3 text-[14px]" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
