"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { formatDuration, formatMoney } from "@/lib/format";

import { fetchSlots, submitBooking } from "./actions";
import { BOOKING_IDLE } from "./booking-state";

export interface PublicService {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  deposit_cents: number;
  swatch: string;
}

export interface PublicStaff {
  id: string;
  name: string;
  swatch: string;
  /** Active services this person does. */
  serviceIds: string[];
}

/** YYYY-MM-DD for an instant, as read in the business's timezone. */
function dayKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function partsIn(iso: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...options,
  }).format(new Date(iso));
}

function BookButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn w-full" disabled={pending}>
      {pending ? "Booking…" : label}
    </button>
  );
}

function timeOf(iso: string, timezone: string): string {
  return partsIn(iso, timezone, { hour: "numeric", minute: "2-digit" });
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Most services one visit may hold; matches the server's limit. */
const MAX_SERVICES = 6;

export function BookingFlow({
  slug,
  timezone,
  currency,
  noShowPolicy,
  services,
  staff,
}: {
  slug: string;
  timezone: string;
  currency: string;
  noShowPolicy: string | null;
  services: PublicService[];
  staff: PublicStaff[];
}) {
  // Kept in menu order whatever order they were tapped in, because that's
  // the order the visit runs in.
  const [picked, setPicked] = useState<string[]>([]);
  // Services first, then time. Splitting the two keeps it obvious that more
  // than one service can be ticked before anything else appears.
  const [step, setStep] = useState<"services" | "time">("services");
  // Null is "anyone available".
  const [staffId, setStaffId] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [state, formAction] = useActionState(submitBooking, BOOKING_IDLE);

  const chosenServices = services.filter((item) => picked.includes(item.id));
  const totalMinutes = chosenServices.reduce((sum, item) => sum + item.duration_minutes, 0);
  const totalCents = chosenServices.reduce((sum, item) => sum + item.price_cents, 0);

  // Staff names only mean anything to a client once there's a choice of
  // people; a solo business never shows them.
  const showStaff = staff.length > 1;
  // One person does the whole visit, so they must do every service in it.
  const candidates = staff.filter((member) =>
    picked.every((id) => member.serviceIds.includes(id)),
  );
  const chosen = staff.find((member) => member.id === staffId) ?? null;

  function loadSlots(ids: string[], nextStaffId: string | null) {
    setSlots([]);
    setDay(null);
    setSlot(null);
    setSlotError(null);

    startLoading(async () => {
      const result = await fetchSlots(slug, ids, nextStaffId);
      if (result.status === "error") {
        setSlotError(result.message);
        return;
      }
      setSlots(result.slots);
      // Land them on the first day that actually has something open.
      const first = result.slots[0];
      if (first) setDay(dayKey(first, timezone));
    });
  }

  function toggleService(id: string) {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= MAX_SERVICES
          ? current
          : services.filter((item) => item.id === id || current.includes(item.id)).map((item) => item.id),
    );
  }

  function goToTime() {
    if (picked.length === 0) return;
    setStep("time");
    setStaffId(null);
    if (candidates.length > 0) loadSlots(picked, null);
    // The time step replaces the list, so start it from the top.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToServices() {
    setStep("services");
    setSlot(null);
  }

  function chooseStaff(id: string | null) {
    setStaffId(id);
    loadSlots(picked, id);
  }

  // Slots grouped by the business's local day, in order.
  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slots) {
      const key = dayKey(iso, timezone);
      const list = map.get(key);
      if (list) list.push(iso);
      else map.set(key, [iso]);
    }
    return map;
  }, [slots, timezone]);

  const days = useMemo(() => [...byDay.keys()], [byDay]);

  // A chosen time belongs to the day it was picked from, so changing day
  // clears it here, at the source of the change, rather than in an effect
  // reacting to it afterwards.
  function chooseDay(key: string) {
    setDay(key);
    setSlot(null);
  }

  if (state.status === "booked") {
    const { confirmation } = state;
    return (
      <section className="card mt-8 text-center" aria-live="polite">
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-soft text-[30px] text-leaf"
          aria-hidden
        >
          ✓
        </div>

        <h2 className="mt-5 font-display text-[24px] leading-none">
          You&rsquo;re booked in
        </h2>

        <p className="mt-3 text-[16px]">
          {partsIn(confirmation.startsAt, confirmation.timezone, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          <br />
          <strong>{timeOf(confirmation.startsAt, confirmation.timezone)}</strong>
          {confirmation.serviceNames.length > 1 && (
            <> until about {timeOf(confirmation.endsAt, confirmation.timezone)}</>
          )}
          {showStaff && <> with {confirmation.staffName}</>}
        </p>

        <ul className="mx-auto mt-4 grid max-w-[320px] gap-1 text-left text-[15px]">
          {confirmation.serviceNames.map((name, index) => (
            <li key={`${name}-${index}`} className="flex items-center gap-2">
              <span className="text-leaf" aria-hidden>✓</span>
              {name}
            </li>
          ))}
        </ul>

        <p className="mt-5 rounded-[14px] bg-notice px-4 py-3 text-[15px]">
          {formatMoney(confirmation.totalCents, confirmation.currency)}, paid at{" "}
          {confirmation.businessName}.
        </p>

        {confirmation.noShowPolicy && (
          <p className="mt-5 text-left text-[14px] text-muted">
            {confirmation.noShowPolicy}
          </p>
        )}
      </section>
    );
  }

  const summary = (
    <>
      {picked.length} service{picked.length === 1 ? "" : "s"} ·{" "}
      {formatDuration(totalMinutes)} · {formatMoney(totalCents, currency)}
    </>
  );

  /* Step 1: services ------------------------------------------------------ */
  if (step === "services") {
    return (
      <section aria-labelledby="service-h" className="mt-8">
        <h2 id="service-h" className="font-display text-[20px] leading-none">
          Choose your services
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          Tick everything you&rsquo;d like. You&rsquo;ll pick one start time for
          the whole visit next.
        </p>

        <ul className="mt-4 grid gap-2">
          {services.map((item) => {
            const on = picked.includes(item.id);
            const full = !on && picked.length >= MAX_SERVICES;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={full}
                  onClick={() => toggleService(item.id)}
                  className={`flex w-full items-center gap-3 rounded-[16px] border-[1.5px] p-3 text-left disabled:opacity-50 ${
                    on ? "border-accent bg-tint" : "border-line bg-paper"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 flex-none place-items-center rounded-[7px] border-[1.5px] text-[14px] font-bold ${
                      on
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line bg-paper text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">
                      {item.name}
                    </span>
                    <span className="block text-[13px] text-muted">
                      {formatDuration(item.duration_minutes)}
                    </span>
                  </span>
                  <span className="font-display text-[15px] leading-none">
                    {formatMoney(item.price_cents, currency)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {picked.length >= MAX_SERVICES && (
          <p className="mt-3 text-[13px] text-muted">
            That&rsquo;s the most for one visit. Book again for anything else.
          </p>
        )}

        {/* Sticks to the bottom of the screen while the menu scrolls, so the
            next step is always in reach, then settles under the list. */}
        <div className="sticky bottom-0 z-20 -mx-5 mt-4 border-t border-line bg-bg/95 backdrop-blur">
          <div className="flex items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 text-[14px]" aria-live="polite">
              {picked.length === 0 ? (
                <span className="text-muted">Nothing picked yet</span>
              ) : (
                <strong>{summary}</strong>
              )}
            </p>
            <button
              type="button"
              className="btn flex-none"
              disabled={picked.length === 0}
              onClick={goToTime}
            >
              Choose a time
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* Step 2: time and details --------------------------------------------- */
  return (
    <form action={formAction} className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8">
      <input type="hidden" name="slug" value={slug} />
      {picked.map((id) => (
        <input key={id} type="hidden" name="serviceId" value={id} />
      ))}
      <input type="hidden" name="staffId" value={staffId ?? ""} />
      <input type="hidden" name="startsAt" value={slot ?? ""} />

      {/* The column is capped at the page width: without that, the sideways-
          scrolling day strip below stretches it and pushes the page off
          centre. */}
      {/* What they picked, with a way back -------------------------------- */}
      <section aria-labelledby="visit-h" className="rounded-[16px] bg-bubble p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="visit-h" className="text-[13px] font-bold text-muted">
            Your visit
          </h2>
          <button
            type="button"
            onClick={backToServices}
            className="text-[14px] font-semibold text-accent underline underline-offset-4"
          >
            Change
          </button>
        </div>
        <ul className="mt-2 grid gap-1 text-[15px]">
          {chosenServices.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.name}</span>
              <span className="text-muted">{formatDuration(item.duration_minutes)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-line pt-2 text-[14px] font-semibold">{summary}</p>
      </section>

      {candidates.length === 0 ? (
        <p className="rounded-[14px] bg-notice px-4 py-3 text-[15px]">
          No one here does all of these in one visit. Try fewer services, or book
          them separately.
        </p>
      ) : (
        <>
          {/* Who -------------------------------------------------------- */}
          {showStaff && candidates.length > 1 && (
            <section aria-labelledby="staff-h">
              <h2 id="staff-h" className="text-[13px] font-bold text-muted">
                Who would you like?
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                {[null, ...candidates].map((member) => {
                  const on = (member?.id ?? null) === staffId;
                  return (
                    <button
                      key={member?.id ?? "anyone"}
                      type="button"
                      onClick={() => chooseStaff(member?.id ?? null)}
                      aria-pressed={on}
                      className={`flex items-center gap-2 rounded-full border-[1.5px] bg-paper py-2 pl-2 pr-4 text-[14px] font-semibold ${
                        on ? "border-accent" : "border-line"
                      }`}
                    >
                      {member ? (
                        <span
                          aria-hidden
                          className="grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold text-white"
                          style={{ background: member.swatch }}
                        >
                          {member.name.trim().charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="grid h-7 w-7 place-items-center rounded-full bg-bubble text-[13px] font-bold text-muted"
                        >
                          ✦
                        </span>
                      )}
                      {member ? member.name : "Anyone available"}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] text-muted">
                {chosen
                  ? `Showing ${chosen.name}'s free times.`
                  : "Showing every time someone is free. You'll see who it's with once you book."}
              </p>
            </section>
          )}

          {showStaff && candidates.length === 1 && (
            <p className="-mt-4 text-[14px] text-muted">
              With <strong className="text-ink">{candidates[0].name}</strong>
            </p>
          )}

          {/* Day and time ----------------------------------------------- */}
          <section aria-labelledby="time-h">
            <h2 id="time-h" className="text-[13px] font-bold text-muted">
              Pick your start time
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Times shown in {timezone.replace(/_/g, " ")}.
            </p>

            {loading && (
              <p className="mt-3 text-[15px] text-muted">Loading times…</p>
            )}

            {slotError && (
              <p className="mt-3 text-[15px] font-semibold text-accent" role="alert">
                {slotError}
              </p>
            )}

            {!loading && !slotError && days.length === 0 && (
              <p className="mt-3 rounded-[14px] bg-bubble px-4 py-3 text-[15px]">
                {chosen
                  ? `${chosen.name} has nothing open for this in the next few weeks. Try anyone available, or fewer services.`
                  : "Nothing open for this in the next few weeks. Try fewer services, or message the business directly."}
              </p>
            )}

            {days.length > 0 && (
              <>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {days.map((key) => {
                    const first = byDay.get(key)![0];
                    const on = day === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => chooseDay(key)}
                        aria-pressed={on}
                        className={`flex-none rounded-[14px] border-[1.5px] px-4 py-2 text-center ${
                          on
                            ? "border-ink bg-ink text-bg"
                            : "border-line bg-paper text-muted"
                        }`}
                      >
                        <span className="block text-[11px]">
                          {partsIn(first, timezone, { weekday: "short" })}
                        </span>
                        <span
                          className={`block font-display text-[14px] leading-none ${on ? "text-bg" : "text-ink"}`}
                        >
                          {partsIn(first, timezone, { day: "numeric" })}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {(day ? (byDay.get(day) ?? []) : []).map((iso) => {
                    const on = slot === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSlot(iso)}
                        aria-pressed={on}
                        className={`rounded-full border-[1.5px] py-2 text-[13px] font-semibold ${
                          on
                            ? "border-accent bg-accent text-accent-ink"
                            : "border-line bg-paper"
                        }`}
                      >
                        {timeOf(iso, timezone)}
                      </button>
                    );
                  })}
                </div>

                {slot && (
                  <p className="mt-3 text-[14px]" aria-live="polite">
                    Arrive at <strong>{timeOf(slot, timezone)}</strong>
                    {picked.length > 1 ? ", all done by about " : ", done by about "}
                    <strong>{timeOf(addMinutes(slot, totalMinutes), timezone)}</strong>.
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* Details --------------------------------------------------------- */}
      {slot && (
        <section aria-labelledby="you-h" className="grid gap-4">
          <h2 id="you-h" className="text-[13px] font-bold text-muted">
            Your details
          </h2>

          <div>
            <label className="label" htmlFor="clientName">
              Your name
            </label>
            <input
              id="clientName"
              name="clientName"
              className="field"
              maxLength={80}
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="clientContact">
              Phone number
            </label>
            <input
              id="clientContact"
              name="clientContact"
              className="field"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={30}
              placeholder="+44 7700 900000"
              aria-describedby="clientContact-hint"
              required
            />
            <p id="clientContact-hint" className="hint">
              With your country code. Used for appointment messages on
              WhatsApp.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="clientEmail">
              Email <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="clientEmail"
              name="clientEmail"
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
            />
          </div>

          {noShowPolicy && (
            <div className="rounded-[14px] bg-notice px-4 py-3 text-[14px]">
              <strong className="block">Before you book</strong>
              <span className="mt-1 block">{noShowPolicy}</span>
            </div>
          )}

          {state.status === "error" && (
            <p className="text-[14px] font-semibold text-accent" role="alert">
              {state.message}
            </p>
          )}

          {/* Deposits are switched off for now: clients pay at the business. */}
          <BookButton label="Confirm booking" />
        </section>
      )}
    </form>
  );
}
