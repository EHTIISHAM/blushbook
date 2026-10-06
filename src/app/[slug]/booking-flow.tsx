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
  const [serviceId, setServiceId] = useState<string | null>(null);
  // Null is "anyone available".
  const [staffId, setStaffId] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [state, formAction] = useActionState(submitBooking, BOOKING_IDLE);

  const service = services.find((item) => item.id === serviceId) ?? null;

  // Staff names only mean anything to a client once there's a choice of
  // people; a solo business never shows them.
  const showStaff = staff.length > 1;
  const candidates = service
    ? staff.filter((member) => member.serviceIds.includes(service.id))
    : [];
  const chosen = staff.find((member) => member.id === staffId) ?? null;

  function loadSlots(nextServiceId: string, nextStaffId: string | null) {
    setSlots([]);
    setDay(null);
    setSlot(null);
    setSlotError(null);

    startLoading(async () => {
      const result = await fetchSlots(slug, nextServiceId, nextStaffId);
      if (result.status === "error") {
        setSlotError(result.message);
        return;
      }
      setSlots(result.slots);
      // Land her on the first day that actually has something open.
      const first = result.slots[0];
      if (first) setDay(dayKey(first, timezone));
    });
  }

  function chooseService(id: string) {
    setServiceId(id);
    setStaffId(null);
    loadSlots(id, null);
  }

  function chooseStaff(id: string | null) {
    if (!serviceId) return;
    setStaffId(id);
    loadSlots(serviceId, id);
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
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-[30px] text-accent-ink"
          aria-hidden
        >
          ✓
        </div>

        <h2 className="mt-5 font-display text-[24px] leading-none">
          You&rsquo;re booked in
        </h2>

        <p className="mt-3 text-[16px]">
          {confirmation.serviceName}
          {showStaff && <> with {confirmation.staffName}</>}
          <br />
          {partsIn(confirmation.startsAt, confirmation.timezone, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}{" "}
          at{" "}
          {partsIn(confirmation.startsAt, confirmation.timezone, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>

        <p className="mt-5 rounded-[14px] bg-notice px-4 py-3 text-[15px]">
          Payment is made at {confirmation.businessName}.
        </p>

        {/* Deposits are switched off for now: clients pay at the business.
        {confirmation.depositCents > 0 && (
          <div className="mt-5 rounded-[14px] bg-notice px-4 py-3 text-[15px]">
            Next, pay the{" "}
            <strong>
              {formatMoney(confirmation.depositCents, confirmation.currency)}
            </strong>{" "}
            deposit to hold your slot.
          </div>
        )}

        {confirmation.depositLink ? (
          <a
            className="btn mt-5 w-full"
            href={confirmation.depositLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Pay the deposit
          </a>
        ) : (
          <p className="mt-5 text-[15px] text-muted">
            {confirmation.businessName} will message you about the deposit.
          </p>
        )} */}

        {confirmation.noShowPolicy && (
          <p className="mt-5 text-left text-[14px] text-muted">
            {confirmation.noShowPolicy}
          </p>
        )}
      </section>
    );
  }

  return (
    <form action={formAction} className="mt-8 grid gap-8">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={serviceId ?? ""} />
      <input type="hidden" name="staffId" value={staffId ?? ""} />
      <input type="hidden" name="startsAt" value={slot ?? ""} />

      {/* Service ------------------------------------------------------- */}
      <section aria-labelledby="service-h">
        <h2 id="service-h" className="text-[13px] font-bold text-muted">
          Choose a service
        </h2>

        <div className="mt-3 grid gap-2">
          {services.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseService(item.id)}
              aria-pressed={serviceId === item.id}
              className={`flex w-full items-center gap-3 rounded-[16px] border-[1.5px] bg-paper p-3 text-left ${
                serviceId === item.id ? "border-accent" : "border-line"
              }`}
            >
              <span
                className="drop"
                style={{ "--swatch": item.swatch } as React.CSSProperties}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  {item.name}
                </span>
                <span className="block text-[13px] text-muted">
                  {formatDuration(item.duration_minutes)}
                  {/* Deposits are switched off for now: clients pay at the business.
                  {item.deposit_cents > 0 && (
                    <>
                      {" · "}
                      {formatMoney(item.deposit_cents, currency)} deposit
                    </>
                  )} */}
                </span>
              </span>
              <span className="font-display text-[15px] leading-none">
                {formatMoney(item.price_cents, currency)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Who ------------------------------------------------------------ */}
      {service && showStaff && candidates.length > 1 && (
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

      {service && showStaff && candidates.length === 1 && (
        <p className="-mt-4 text-[14px] text-muted">
          With <strong className="text-ink">{candidates[0].name}</strong>
        </p>
      )}

      {/* Day and time --------------------------------------------------- */}
      {service && (
        <section aria-labelledby="time-h">
          <h2 id="time-h" className="text-[13px] font-bold text-muted">
            Pick a time
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
                ? `${chosen.name} has nothing open for this in the next few weeks. Try anyone available, or another service.`
                : "Nothing open for this service in the next few weeks. Try another service, or message the business directly."}
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
                      {partsIn(iso, timezone, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
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

          {/* Deposits are switched off for now: clients pay at the business.
          label={
            service && service.deposit_cents > 0
              ? `Book and pay ${formatMoney(service.deposit_cents, currency)} deposit`
              : "Confirm booking"
          } */}
          <BookButton label="Confirm booking" />
        </section>
      )}
    </form>
  );
}
