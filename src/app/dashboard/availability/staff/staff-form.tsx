"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";
import { SWATCHES } from "@/lib/swatches";
import type { StaffRow } from "@/lib/supabase/database.types";

import { WeekFields, type DayWindow } from "../week-fields";
import { saveStaff } from "./actions";

export interface ServiceChoice {
  id: string;
  name: string;
  is_active: boolean;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function StaffForm({
  staff,
  services,
  ownHours,
  businessHours,
  serviceIds,
  submitLabel,
  resetOnSuccess = false,
}: {
  staff?: StaffRow;
  services: ServiceChoice[];
  /** Their own hours, if they have any saved. */
  ownHours: Record<number, DayWindow | undefined>;
  /** Where "own hours" starts from when they have none yet. */
  businessHours: Record<number, DayWindow | undefined>;
  /** Services ticked when they don't do everything. */
  serviceIds: string[];
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(saveStaff, IDLE);
  const [hours, setHours] = useState<"business" | "own">(
    staff && !staff.hours_follow_business ? "own" : "business",
  );
  const [scope, setScope] = useState<"all" | "some">(
    staff && !staff.all_services ? "some" : "all",
  );

  const key = staff?.id ?? "new";
  const hasOwnHours = Object.values(ownHours).some(Boolean);
  const ticked = new Set(serviceIds);

  // Remounting on success is what clears the add form.
  const formKey =
    resetOnSuccess && state.status === "success" ? state.message : "form";

  return (
    <form key={formKey} action={formAction} className="grid gap-5">
      {staff && <input type="hidden" name="id" value={staff.id} />}

      <div>
        <label className="label" htmlFor={`staff-name-${key}`}>
          Name
        </label>
        <input
          id={`staff-name-${key}`}
          name="name"
          className="field"
          maxLength={60}
          placeholder="Sana"
          defaultValue={staff?.name === "Owner" ? "" : (staff?.name ?? "")}
          required
        />
        <p className="hint">Clients see this when you have more than one person.</p>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap items-center gap-3">
          {SWATCHES.map((swatch, index) => {
            const id = `staff-swatch-${key}-${index}`;
            const checked = staff
              ? staff.swatch.toLowerCase() === swatch.toLowerCase()
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
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full peer-checked:shadow-[inset_0_0_0_2px_var(--ink)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
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

      {/* Hours ------------------------------------------------------------ */}
      <fieldset className="border-0 p-0">
        <legend className="label">Hours</legend>
        <div className="grid gap-2">
          <label className="flex items-center gap-3 text-[15px]">
            <input
              type="radio"
              name="hours"
              value="business"
              checked={hours === "business"}
              onChange={() => setHours("business")}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            Same as the business hours
          </label>
          <label className="flex items-center gap-3 text-[15px]">
            <input
              type="radio"
              name="hours"
              value="own"
              checked={hours === "own"}
              onChange={() => setHours("own")}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            Their own hours
          </label>
        </div>

        {hours === "own" && (
          <div className="mt-3 rounded-[18px] bg-bubble/50 p-3">
            <WeekFields
              initial={hasOwnHours ? ownHours : businessHours}
              closedLabel="Not working"
            />
            <p className="hint">
              They can only be booked while the business is open too.
            </p>
          </div>
        )}
      </fieldset>

      {/* Services --------------------------------------------------------- */}
      <fieldset className="border-0 p-0">
        <legend className="label">Services they do</legend>
        <div className="grid gap-2">
          <label className="flex items-center gap-3 text-[15px]">
            <input
              type="radio"
              name="services"
              value="all"
              checked={scope === "all"}
              onChange={() => setScope("all")}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            All services, including ones added later
          </label>
          <label className="flex items-center gap-3 text-[15px]">
            <input
              type="radio"
              name="services"
              value="some"
              checked={scope === "some"}
              onChange={() => setScope("some")}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            Only some
          </label>
        </div>

        {scope === "some" &&
          (services.length === 0 ? (
            <p className="hint">Add services on the Services tab first.</p>
          ) : (
            <div className="mt-3 grid gap-2 rounded-[18px] bg-bubble/50 p-3">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-3 text-[15px]"
                >
                  <input
                    type="checkbox"
                    name="service_id"
                    value={service.id}
                    defaultChecked={ticked.has(service.id)}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  {service.name}
                  {!service.is_active && (
                    <span className="rounded-full bg-bubble px-2 py-0.5 text-[11px] font-bold text-muted">
                      Hidden
                    </span>
                  )}
                </label>
              ))}
            </div>
          ))}
      </fieldset>

      <label className="flex items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={staff?.is_active ?? true}
          className="h-5 w-5 accent-[var(--accent)]"
        />
        Taking bookings
      </label>

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

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
