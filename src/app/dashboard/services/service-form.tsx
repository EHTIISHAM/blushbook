"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE, type ActionState } from "@/lib/action-state";
import { centsToInput } from "@/lib/format";
import type { ServiceRow } from "@/lib/supabase/database.types";

/** Swatches drawn from the brand palette, plus room to go off-script. */
const SWATCHES = [
  "#B3123F",
  "#F0547E",
  "#8E5B9A",
  "#E58FA8",
  "#C77D3A",
  "#5B8C7B",
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

interface ServiceFormProps {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  service?: ServiceRow;
  currency: string;
  submitLabel: string;
  /** Clears the fields after a successful add. */
  resetOnSuccess?: boolean;
}

export function ServiceForm({
  action,
  service,
  currency,
  submitLabel,
  resetOnSuccess = false,
}: ServiceFormProps) {
  const [state, formAction] = useActionState(action, IDLE);

  // Remounting on success is what clears the add form; the edit form keeps
  // whatever she typed so a validation message stays next to her input.
  const formKey =
    resetOnSuccess && state.status === "success" ? state.message : "form";

  return (
    <form key={formKey} action={formAction} className="grid gap-4">
      {service && <input type="hidden" name="id" value={service.id} />}

      <div>
        <label className="label" htmlFor={`name-${service?.id ?? "new"}`}>
          Service name
        </label>
        <input
          id={`name-${service?.id ?? "new"}`}
          name="name"
          className="field"
          maxLength={80}
          placeholder="Classic full set"
          defaultValue={service?.name ?? ""}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            className="label"
            htmlFor={`duration-${service?.id ?? "new"}`}
          >
            Minutes
          </label>
          <input
            id={`duration-${service?.id ?? "new"}`}
            name="duration_minutes"
            className="field"
            type="number"
            inputMode="numeric"
            min={5}
            max={1440}
            step={5}
            placeholder="120"
            defaultValue={service?.duration_minutes ?? ""}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor={`price-${service?.id ?? "new"}`}>
            Price ({currency})
          </label>
          <input
            id={`price-${service?.id ?? "new"}`}
            name="price"
            className="field"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="60.00"
            defaultValue={service ? centsToInput(service.price_cents) : ""}
            required
          />
        </div>

        <div>
          <label
            className="label"
            htmlFor={`deposit-${service?.id ?? "new"}`}
          >
            Deposit ({currency})
          </label>
          <input
            id={`deposit-${service?.id ?? "new"}`}
            name="deposit"
            className="field"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="15.00"
            defaultValue={service ? centsToInput(service.deposit_cents) : "0.00"}
            required
          />
        </div>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="label">Swatch</legend>
        <div className="flex flex-wrap items-center gap-3">
          {SWATCHES.map((swatch, index) => {
            const id = `swatch-${service?.id ?? "new"}-${index}`;
            const checked = service
              ? service.swatch.toLowerCase() === swatch.toLowerCase()
              : index === 0;

            return (
              <span key={swatch} className="relative inline-flex">
                <input
                  id={id}
                  type="radio"
                  name="swatch"
                  value={swatch}
                  defaultChecked={checked}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                />
                <label
                  htmlFor={id}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full peer-checked:shadow-[inset_0_0_0_2px_var(--ink)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cherry"
                >
                  <span
                    className="drop"
                    style={{ "--swatch": swatch } as React.CSSProperties}
                  />
                  <span className="sr-only">{swatch}</span>
                </label>
              </span>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={service?.is_active ?? true}
          className="h-5 w-5 accent-[var(--cherry)]"
        />
        Show this service on my booking page
      </label>

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
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
