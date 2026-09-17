"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";
import { normalizeSlug } from "@/lib/slug";
import type { ProfileRow } from "@/lib/supabase/database.types";

import { saveProfile } from "./actions";

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
      {pending ? "Saving…" : "Save profile"}
    </button>
  );
}

export function ProfileForm({
  profile,
  timezones,
  siteHost,
}: {
  profile: ProfileRow;
  timezones: string[];
  siteHost: string;
}) {
  const [state, formAction] = useActionState(saveProfile, IDLE);
  const [slug, setSlug] = useState(profile.slug);

  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <div>
        <label className="label" htmlFor="slug">
          Your booking link
        </label>
        <div className="flex items-stretch overflow-hidden rounded-[14px] border-[1.5px] border-line focus-within:border-cherry">
          <span className="flex select-none items-center whitespace-nowrap bg-bubble px-3 text-[14px] text-muted">
            {siteHost}/
          </span>
          <input
            id="slug"
            name="slug"
            className="min-w-0 flex-1 bg-paper px-3 py-[11px] text-[15px] text-ink outline-none"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            onBlur={(event) => setSlug(normalizeSlug(event.target.value))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            required
          />
        </div>
        <p className="hint">
          Lowercase letters, numbers, dashes and underscores. This is what goes
          in your bio.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="business_name">
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          className="field"
          maxLength={80}
          placeholder="Lashes by Hira"
          defaultValue={profile.business_name}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="instagram_handle">
          Instagram handle{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="instagram_handle"
          name="instagram_handle"
          className="field"
          maxLength={31}
          placeholder="@lashesbyhira"
          defaultValue={
            profile.instagram_handle ? `@${profile.instagram_handle}` : ""
          }
        />
      </div>

      <div>
        <label className="label" htmlFor="bio">
          Bio <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          className="field min-h-[96px] resize-y"
          maxLength={300}
          placeholder="Lash artist in Birmingham. Hybrid and volume sets."
          defaultValue={profile.bio ?? ""}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="timezone">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            className="field"
            defaultValue={profile.timezone}
            required
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="hint">Clients see your times in this zone.</p>
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
            defaultValue={profile.currency}
            required
          />
          <datalist id="currency-options">
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
          <p className="hint">Used for your prices and deposits.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="deposit_link">
          Deposit link
        </label>
        <input
          id="deposit_link"
          name="deposit_link"
          className="field"
          type="url"
          inputMode="url"
          placeholder="https://paypal.me/lashesbyhira"
          defaultValue={profile.deposit_link ?? ""}
        />
        <p className="hint">
          Your own PayPal, Stripe or bank link. Clients land here right after
          they book, and the money goes straight to you.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="no_show_policy">
          No-show policy
        </label>
        <textarea
          id="no_show_policy"
          name="no_show_policy"
          className="field min-h-[96px] resize-y"
          maxLength={500}
          placeholder="Deposits are non-refundable. Reschedule at least 24 hours ahead and your deposit moves with you."
          defaultValue={profile.no_show_policy ?? ""}
        />
        <p className="hint">Clients read this before they confirm.</p>
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
        <SaveButton />
      </div>
    </form>
  );
}
