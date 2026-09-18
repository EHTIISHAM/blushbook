import type { Metadata } from "next";

import { formatDuration, formatMoney } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ServiceRow } from "@/lib/supabase/database.types";

import { createService, deleteService, moveService, updateService } from "./actions";
import { ServiceForm } from "./service-form";

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

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-labelledby="services-h">
        <h1 id="services-h" className="font-display text-[27px] leading-none">
          Services
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          These are what clients pick from on your booking page, in this order.
        </p>

        {error && (
          <p className="mt-6 rounded-[14px] bg-butter px-4 py-3 text-[15px]">
            Couldn&rsquo;t load your services: {error.message}
          </p>
        )}

        {!error && services.length === 0 && (
          <p className="mt-6 rounded-[14px] bg-bubble px-4 py-3 text-[15px]">
            No services yet. Add your first one and it shows up here.
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
                  </p>
                  <p className="text-[13px] text-muted">
                    {formatDuration(service.duration_minutes)} ·{" "}
                    {formatMoney(service.deposit_cents, profile.currency)}{" "}
                    deposit
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
                    submitLabel="Save changes"
                  />

                  <form action={deleteService} className="mt-4">
                    <input type="hidden" name="id" value={service.id} />
                    <button
                      type="submit"
                      className="text-[14px] font-semibold text-cherry underline underline-offset-4"
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
            submitLabel="Add service"
            resetOnSuccess
          />
        </div>
      </section>
    </div>
  );
}
