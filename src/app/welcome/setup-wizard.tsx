"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import { MenuScanner } from "@/app/dashboard/services/menu-scanner";
import { UsualDurationPicker } from "@/components/usual-duration-picker";
import { IDLE, type ActionState } from "@/lib/action-state";
import { WEEKDAYS } from "@/lib/format";
import { normalizeSlug } from "@/lib/slug";
import type { ProfileRow } from "@/lib/supabase/database.types";
import type { Sector } from "@/lib/timing-rules";

import {
  addFirstService,
  saveSetupHours,
  saveStudio,
} from "./actions";

const STEPS = ["Your business", "Your services", "Your hours"];

const CURRENCIES = [
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

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function Continue({ label = "Continue" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn w-full" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.status !== "error") return null;
  return (
    <p className="text-[14px] font-semibold text-accent" role="alert">
      {state.message}
    </p>
  );
}

/**
 * Advances the wizard once a step's action reports success.
 *
 * onDone is stable (useCallback in the parent), so depending on it directly
 * is safe and avoids writing to a ref during render.
 */
function useAdvanceOnSuccess(state: ActionState, onDone: () => void) {
  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state.status, onDone]);
}

/* The browser knows her timezone; reading it through useSyncExternalStore
   gives the server an empty snapshot and the client the real value, so there
   is no hydration mismatch and no setState in an effect. */

const subscribeToNothing = () => () => {};

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

const serverTimezone = () => "";

/* ------------------------------------------------------------------ */

function BusinessStep({
  profile,
  bookingHost,
  onDone,
}: {
  profile: ProfileRow;
  bookingHost: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveStudio, IDLE);
  const [slug, setSlug] = useState(profile.slug);

  // Detected rather than asked for, so nobody hunts through a dropdown.
  const timezone = useSyncExternalStore(
    subscribeToNothing,
    browserTimezone,
    serverTimezone,
  );

  useAdvanceOnSuccess(state, onDone);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="timezone" value={timezone} />

      <div>
        <label className="label" htmlFor="business_name">
          What&rsquo;s your business called?
        </label>
        <input
          id="business_name"
          name="business_name"
          className="field"
          maxLength={80}
          placeholder="Harbour Clinic"
          defaultValue={profile.business_name}
          autoFocus
          required
        />
        <p className="hint">Clients see this at the top of your page.</p>
      </div>

      <div>
        <label className="label" htmlFor="slug">
          Your booking link
        </label>
        <div className="flex items-stretch overflow-hidden rounded-[14px] border-[1.5px] border-line focus-within:border-accent">
          <span className="flex select-none items-center whitespace-nowrap bg-bubble px-3 text-[14px] text-muted">
            {bookingHost}/
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
          The link you send to clients. You can change it later.
        </p>
      </div>

      {timezone && (
        <p className="rounded-[14px] bg-bubble px-4 py-3 text-[14px]">
          Times will show in <strong>{timezone.replace(/_/g, " ")}</strong>,
          picked up from your phone. Change it any time in Settings.
        </p>
      )}

      <Feedback state={state} />
      <Continue />
    </form>
  );
}

/* ------------------------------------------------------------------ */

function ServiceStep({
  currency,
  usualMinutes,
  sector,
  onDone,
}: {
  currency: string;
  usualMinutes: number;
  sector: Sector | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(addFirstService, IDLE);
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  useAdvanceOnSuccess(state, onDone);

  if (mode === "scan") {
    return (
      <div className="grid gap-5">
        <MenuScanner
          currency={currency}
          usualMinutes={usualMinutes}
          sector={sector}
        />
        <button type="button" className="btn w-full" onClick={onDone}>
          Continue
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="text-[14px] font-semibold text-accent underline underline-offset-4"
        >
          No rate card? Add a service by hand
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <fieldset className="border-0 p-0">
        <legend className="label">How long is a usual appointment?</legend>
        <UsualDurationPicker value={usualMinutes} idPrefix="setup-usual" />
        <p className="hint">
          Every service uses this unless you give it its own time.
        </p>
      </fieldset>

      <div>
        <label className="label" htmlFor="name">
          Your most booked service
        </label>
        <input
          id="name"
          name="name"
          className="field"
          maxLength={80}
          placeholder="Initial consultation"
          autoFocus
          required
        />
        <p className="hint">
          Add the rest afterwards on the Services tab.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="price">
            Price
          </label>
          <input
            id="price"
            name="price"
            className="field"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="60.00"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="currency">
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            className="field"
            defaultValue={currency}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Feedback state={state} />
      <Continue />
    </form>
  );
}

/* ------------------------------------------------------------------ */

function HoursStep({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(saveSetupHours, IDLE);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useAdvanceOnSuccess(state, onDone);

  function toggle(weekday: number) {
    setDays((current) =>
      current.includes(weekday)
        ? current.filter((value) => value !== weekday)
        : [...current, weekday],
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <fieldset className="border-0 p-0">
        <legend className="label">Which days do you work?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {DISPLAY_ORDER.map((weekday) => {
            const on = days.includes(weekday);
            return (
              <button
                key={weekday}
                type="button"
                onClick={() => toggle(weekday)}
                aria-pressed={on}
                className={`rounded-full px-4 py-2 text-[14px] font-semibold ${
                  on
                    ? "bg-accent text-accent-ink"
                    : "bg-paper text-muted shadow-[inset_0_0_0_1.5px_var(--line)]"
                }`}
              >
                {WEEKDAYS[weekday].slice(0, 3)}
              </button>
            );
          })}
        </div>
        {days.map((weekday) => (
          <input key={weekday} type="hidden" name="weekday" value={weekday} />
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="start">
            Open at
          </label>
          <input
            id="start"
            name="start"
            type="time"
            className="field"
            defaultValue="09:00"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="end">
            Last appointment ends
          </label>
          <input
            id="end"
            name="end"
            type="time"
            className="field"
            defaultValue="17:00"
            required
          />
        </div>
      </div>

      <p className="hint">
        Same hours on every day you picked. You can set different hours per day,
        and block time off, on the Availability tab.
      </p>

      <Feedback state={state} />
      <Continue label="Finish setup" />
    </form>
  );
}

/* ------------------------------------------------------------------ */

function DoneStep({ bookingUrl }: { bookingUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="text-center">
      <div
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-soft text-[30px] text-leaf"
        aria-hidden
      >
        ✓
      </div>

      <h2 className="mt-5 font-display text-[24px] leading-none">
        Your page is ready
      </h2>
      <p className="mx-auto mt-3 max-w-[38ch] text-[15px] text-muted">
        Send this link to clients, or add it to your website and profiles.
        Everything else you can change from your dashboard.
      </p>

      <div className="mt-6 flex items-stretch gap-2">
        <input
          className="field text-center"
          value={bookingUrl}
          readOnly
          onFocus={(event) => event.target.select()}
          aria-label="Your booking link"
        />
        <button type="button" className="btn btn-sm flex-none" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <Link href="/dashboard" className="btn mt-6 w-full">
        Go to my dashboard
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function SetupWizard({
  profile,
  startStep,
  bookingHost,
  bookingUrl,
}: {
  profile: ProfileRow;
  startStep: number;
  bookingHost: string;
  bookingUrl: string;
}) {
  const [step, setStep] = useState(startStep);
  const next = useCallback(() => setStep((current) => current + 1), []);

  const isDone = step >= STEPS.length;

  return (
    <div>
      {!isDone && (
        <>
          <p className="text-[13px] font-bold text-muted">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-1 font-display text-[26px] leading-none">
            {STEPS[step]}
          </h1>

          <ol className="mt-5 mb-7 flex gap-1.5" aria-label="Setup progress">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={`h-1.5 flex-1 rounded-full ${
                  index <= step ? "bg-accent" : "bg-line"
                }`}
              >
                <span className="sr-only">
                  {label}
                  {index < step
                    ? " — done"
                    : index === step
                      ? " — current"
                      : ""}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {step === 0 && (
        <BusinessStep
          profile={profile}
          bookingHost={bookingHost}
          onDone={next}
        />
      )}
      {step === 1 && (
        <ServiceStep
          currency={profile.currency}
          usualMinutes={profile.default_duration_minutes}
          sector={profile.business_sector}
          onDone={next}
        />
      )}
      {step === 2 && <HoursStep onDone={next} />}
      {isDone && <DoneStep bookingUrl={bookingUrl} />}

      {!isDone && step > 0 && (
        <button
          type="button"
          onClick={() => setStep((current) => current - 1)}
          className="mt-4 w-full text-[14px] font-semibold text-muted underline underline-offset-4"
        >
          Back
        </button>
      )}
    </div>
  );
}
