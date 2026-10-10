import type { Metadata } from "next";

import { formatDuration, formatMoney } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ServiceRow } from "@/lib/supabase/database.types";

import {
  confirmServiceTiming,
  createService,
  deleteService,
  moveService,
  updateService,
} from "./actions";
import { MenuScanner } from "./menu-scanner";
import { ServiceForm } from "./service-form";
import { UsualDurationForm } from "./usual-duration-form";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const services: ServiceRow[] = data ?? [];
  const toCheck = services.filter((service) => service.timing_review_note);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-labelledby="services-h">
        <h1 id="services-h" className="font-display text-[27px] leading-none">
          Services
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          These are what clients pick from on your booking page, in this order.
        </p>

        <div className="mt-6 grid gap-4">
          <UsualDurationForm value={profile.default_duration_minutes} />
          <MenuScanner
            currency={profile.currency}
            usualMinutes={profile.default_duration_minutes}
            sector={profile.business_sector}
          />
        </div>

        {toCheck.length > 0 && (
          <section
            aria-labelledby="check-h"
            className="mt-6 rounded-[14px] bg-notice px-4 py-4"
          >
            <h2 id="check-h" className="text-[15px] font-semibold">
              Check {toCheck.length} timing{toCheck.length === 1 ? "" : "s"}{" "}
              before clients book
            </h2>
            <p className="mt-1 text-[14px]">
              These times were suggested for you and vary a lot from business
              to business. Confirm each one, or open Edit below to change it.
            </p>
            <ul className="mt-3 grid gap-2">
              {toCheck.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] bg-paper px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">
                      {service.name} &middot;{" "}
                      {formatDuration(service.duration_minutes)}
                      {service.buffer_minutes > 0 &&
                        ` + ${formatDuration(service.buffer_minutes)} buffer`}
                    </p>
                    <p className="text-[13px] text-muted">
                      {service.timing_review_note}
                    </p>
                  </div>
                  <form action={confirmServiceTiming}>
                    <input type="hidden" name="id" value={service.id} />
                    <button type="submit" className="btn btn-sm">
                      Looks right
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p className="mt-6 rounded-[14px] bg-notice px-4 py-3 text-[15px]">
            Couldn&rsquo;t load your services: {error.message}
          </p>
        )}

        {!error && services.length === 0 && (
          <p className="mt-6 rounded-[14px] bg-bubble px-4 py-3 text-[15px]">
            No services yet. Upload your rate card above, or add them one at a
            time.
          </p>
        )}

        <ul className="mt-6 grid gap-3">
          {services.map((service, index) => (
            <li key={service.id} className="card p-4">
              <div className="flex items-center gap-3">
                <span
                  className="drop"
                  style={{ "--swatch": service.swatch } as React.CSSProperties}
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {service.name}
                    {!service.is_active && (
                      <span className="ml-2 rounded-full bg-bubble px-2 py-0.5 align-middle text-[11px] font-bold text-muted">
                        Hidden
                      </span>
                    )}
                    {service.timing_review_note && (
                      <span className="ml-2 rounded-full bg-notice px-2 py-0.5 align-middle text-[11px] font-bold">
                        Check time
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-muted">
                    {formatDuration(service.duration_minutes)}
                    {service.duration_is_default && " (usual)"}
                    {service.buffer_minutes > 0 &&
                      ` + ${formatDuration(service.buffer_minutes)} buffer`}
                    {/* Deposits are switched off for now: clients pay at the business.
                    {" · "}
                    {formatMoney(service.deposit_cents, profile.currency)}{" "}
                    deposit */}
                  </p>
                </div>

                <span className="font-display text-[15px] leading-none">
                  {formatMoney(service.price_cents, profile.currency)}
                </span>

                <span className="flex flex-col gap-1">
                  <form action={moveService}>
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:text-ink disabled:opacity-25"
                      disabled={index === 0}
                      aria-label={`Move ${service.name} up`}
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveService}>
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:text-ink disabled:opacity-25"
                      disabled={index === services.length - 1}
                      aria-label={`Move ${service.name} down`}
                    >
                      ↓
                    </button>
                  </form>
                </span>
              </div>

              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-[14px] font-semibold text-muted">
                  Edit
                </summary>

                <div className="mt-4">
                  <ServiceForm
                    action={updateService}
                    service={service}
                    currency={profile.currency}
                    usualMinutes={profile.default_duration_minutes}
                    submitLabel="Save changes"
                  />

                  <form action={deleteService} className="mt-4">
                    <input type="hidden" name="id" value={service.id} />
                    <button
                      type="submit"
                      className="text-[14px] font-semibold text-accent underline underline-offset-4"
                    >
                      Delete this service
                    </button>
                    <p className="hint">
                      Bookings already made keep their name and price.
                    </p>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="add-h" className="card lg:sticky lg:top-6">
        <h2 id="add-h" className="font-display text-[19px] leading-none">
          Add a service
        </h2>

        <div className="mt-5">
          <ServiceForm
            action={createService}
            currency={profile.currency}
            usualMinutes={profile.default_duration_minutes}
            submitLabel="Add service"
            resetOnSuccess
          />
        </div>
      </section>
    </div>
  );
}
