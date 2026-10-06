import type { Metadata } from "next";
import Link from "next/link";

import { upcomingConflictIds } from "@/lib/conflicts";
import { minutesToLabel, WEEKDAYS } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { StaffRow } from "@/lib/supabase/database.types";
import { firstWindowPerDay } from "@/lib/week";

import { removeTimeOff } from "./actions";
import { DeleteStaffButton, TimeOffForm } from "./staff-extras";
import { StaffForm } from "./staff-form";

export const metadata: Metadata = { title: "Staff" };

/** Monday first, matching the hours editor. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Today's date in the business's timezone, as YYYY-MM-DD. */
function todayIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "Mon, Tue, Wed 12:00pm–8:00pm · Sat 10:00am–2:00pm" */
function weekSummary(
  rows: { weekday: number; start_minute: number; end_minute: number }[],
): string {
  const groups = new Map<string, string[]>();
  const byDay = firstWindowPerDay(rows);

  for (const weekday of DISPLAY_ORDER) {
    const window = byDay[weekday];
    if (!window) continue;
    const label = `${minutesToLabel(window.start_minute)}–${minutesToLabel(window.end_minute)}`;
    groups.set(label, [...(groups.get(label) ?? []), WEEKDAYS[weekday].slice(0, 3)]);
  }

  if (groups.size === 0) return "No working days";
  return [...groups.entries()].map(([label, days]) => `${days.join(", ")} ${label}`).join(" · ");
}

export default async function StaffPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const today = todayIn(profile.timezone);

  const [staffResult, hoursResult, linksResult, timeOffResult, servicesResult, businessResult, upcomingResult, everBookedResult, conflicts] =
    await Promise.all([
      supabase
        .from("staff")
        .select("*")
        .eq("profile_id", profile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("staff_hours")
        .select("staff_id, weekday, start_minute, end_minute")
        .eq("profile_id", profile.id),
      supabase
        .from("staff_services")
        .select("staff_id, service_id")
        .eq("profile_id", profile.id),
      supabase
        .from("staff_time_off")
        .select("id, staff_id, off_on, note")
        .eq("profile_id", profile.id)
        .gte("off_on", today)
        .order("off_on", { ascending: true }),
      supabase
        .from("services")
        .select("id, name, is_active")
        .eq("profile_id", profile.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("availability")
        .select("weekday, start_minute, end_minute")
        .eq("profile_id", profile.id),
      supabase
        .from("bookings")
        .select("id, staff_id")
        .eq("profile_id", profile.id)
        .eq("status", "booked")
        .gte("starts_at", new Date().toISOString())
        .limit(2000),
      // One row per staff member is enough to know who has history.
      supabase
        .from("bookings")
        .select("staff_id")
        .eq("profile_id", profile.id)
        .limit(5000),
      upcomingConflictIds(supabase),
    ]);

  const staff: StaffRow[] = staffResult.data ?? [];
  const services = servicesResult.data ?? [];
  const businessHours = firstWindowPerDay(businessResult.data ?? []);
  const activeCount = staff.filter((member) => member.is_active).length;
  const onlyOwner = staff.length === 1 && staff[0].name === "Owner";

  const upcomingBy = new Map<string, number>();
  const conflictsBy = new Map<string, number>();
  for (const booking of upcomingResult.data ?? []) {
    upcomingBy.set(booking.staff_id, (upcomingBy.get(booking.staff_id) ?? 0) + 1);
    if (conflicts.has(booking.id)) {
      conflictsBy.set(booking.staff_id, (conflictsBy.get(booking.staff_id) ?? 0) + 1);
    }
  }
  const hasHistory = new Set((everBookedResult.data ?? []).map((row) => row.staff_id));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-labelledby="staff-h">
        <h1 id="staff-h" className="font-display text-[27px] leading-none">
          Staff
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Everyone clients can book with. Each person can have their own hours,
          days off and services. Once you have two or more, clients can pick
          who they want or take anyone available.
        </p>

        {staffResult.error && (
          <p className="mt-6 rounded-[14px] bg-notice px-4 py-3 text-[15px]">
            Couldn&rsquo;t load your staff: {staffResult.error.message}
          </p>
        )}

        {onlyOwner && (
          <p className="mt-6 rounded-[14px] bg-notice px-4 py-3 text-[15px]">
            Working alone? Nothing to do here. Before adding someone, open{" "}
            <strong>Owner</strong> below and put in your own name, since
            clients will see it.
          </p>
        )}

        <ul className="mt-6 grid gap-3">
          {staff.map((member) => {
            const ownRows = (hoursResult.data ?? []).filter(
              (row) => row.staff_id === member.id,
            );
            const serviceIds = (linksResult.data ?? [])
              .filter((row) => row.staff_id === member.id)
              .map((row) => row.service_id);
            const daysOff = (timeOffResult.data ?? []).filter(
              (row) => row.staff_id === member.id,
            );
            const upcoming = upcomingBy.get(member.id) ?? 0;
            const stranded = conflictsBy.get(member.id) ?? 0;

            return (
              <li key={member.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="drop"
                    style={{ "--swatch": member.swatch } as React.CSSProperties}
                    aria-hidden
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {member.name}
                      {!member.is_active && (
                        <span className="ml-2 rounded-full bg-bubble px-2 py-0.5 align-middle text-[11px] font-bold text-muted">
                          Not taking bookings
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] text-muted">
                      {member.hours_follow_business
                        ? "Business hours"
                        : weekSummary(ownRows)}
                      {" · "}
                      {member.all_services
                        ? "All services"
                        : `${serviceIds.length} of ${services.length} services`}
                    </p>
                    <p className="text-[13px] text-muted">
                      {upcoming === 0
                        ? "No upcoming bookings"
                        : `${upcoming} upcoming booking${upcoming === 1 ? "" : "s"}`}
                      {daysOff.length > 0 &&
                        ` · ${daysOff.length} day${daysOff.length === 1 ? "" : "s"} off coming up`}
                    </p>
                  </div>
                </div>

                {stranded > 0 && (
                  <p className="mt-3 rounded-[14px] bg-notice px-4 py-3 text-[14px]">
                    <strong>
                      {stranded} upcoming booking{stranded === 1 ? "" : "s"}
                    </strong>{" "}
                    no longer fit{stranded === 1 ? "s" : ""} {member.name}
                    &rsquo;s hours, days off or services. They&rsquo;re still
                    booked.{" "}
                    <Link
                      href={`/dashboard?staff=${member.id}`}
                      className="font-semibold underline underline-offset-4"
                    >
                      Move or keep them
                    </Link>
                  </p>
                )}

                <details className="mt-3 border-t border-line pt-3">
                  <summary className="cursor-pointer text-[14px] font-semibold text-muted">
                    Edit
                  </summary>

                  <div className="mt-4">
                    <StaffForm
                      staff={member}
                      services={services}
                      ownHours={firstWindowPerDay(ownRows)}
                      businessHours={businessHours}
                      serviceIds={serviceIds}
                      submitLabel="Save changes"
                    />
                  </div>

                  <div className="mt-6 border-t border-line pt-4">
                    <h3 className="text-[14px] font-bold">Days off</h3>
                    <p className="hint">
                      Nobody can book {member.name} on these days. Bookings
                      already made stay, and get flagged for you to move.
                    </p>

                    {daysOff.length > 0 && (
                      <ul className="mt-3 grid gap-2">
                        {daysOff.map((day) => (
                          <li
                            key={day.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="min-w-0">
                              <span className="block text-[14px] font-semibold">
                                {formatDate(day.off_on)}
                              </span>
                              {day.note && (
                                <span className="block truncate text-[13px] text-muted">
                                  {day.note}
                                </span>
                              )}
                            </span>
                            <form action={removeTimeOff}>
                              <input type="hidden" name="id" value={day.id} />
                              <button
                                type="submit"
                                className="text-[13px] font-semibold text-accent underline underline-offset-4"
                              >
                                Remove
                                <span className="sr-only">
                                  {" "}
                                  {formatDate(day.off_on)}
                                </span>
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}

                    <TimeOffForm staffId={member.id} name={member.name} today={today} />
                  </div>

                  {!hasHistory.has(member.id) && (!member.is_active || activeCount > 1) && (
                    <div className="mt-6 border-t border-line pt-4">
                      <DeleteStaffButton staffId={member.id} name={member.name} />
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="add-staff-h" className="card lg:sticky lg:top-6">
        <h2 id="add-staff-h" className="font-display text-[19px] leading-none">
          Add a staff member
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          They don&rsquo;t need an account. You manage their hours and bookings
          from here.
        </p>

        <div className="mt-5">
          <StaffForm
            services={services}
            ownHours={{}}
            businessHours={businessHours}
            serviceIds={[]}
            submitLabel="Add staff member"
            resetOnSuccess
          />
        </div>
      </section>
    </div>
  );
}
