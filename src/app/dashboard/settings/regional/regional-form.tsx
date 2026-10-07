"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";

import { saveRegional } from "../profile/actions";

const COMMON_CURRENCIES = [
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "AUD",
  "AED",
  "PKR",
  "INR",
  "NGN",
  "ZAR",
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function RegionalForm({
  timezone,
  currency,
  timezones,
}: {
  timezone: string;
  currency: string;
  timezones: string[];
}) {
  const [state, formAction] = useActionState(saveRegional, IDLE);

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <div>
        <label className="label" htmlFor="timezone">
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          className="field"
          defaultValue={timezone}
          required
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="hint">
          Your hours and every booking time use this zone. Clients see times
          in it too.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="currency">
          Currency
        </label>
        <input
          id="currency"
          name="currency"
          className="field uppercase"
          list="currency-options"
          maxLength={3}
          minLength={3}
          pattern="[A-Za-z]{3}"
          defaultValue={currency}
          required
        />
        <datalist id="currency-options">
          {COMMON_CURRENCIES.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
        <p className="hint">
          A 3 letter code, like USD or PKR. Used for every price.
        </p>
      </div>

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
        <SaveButton />
      </div>
    </form>
  );
}
