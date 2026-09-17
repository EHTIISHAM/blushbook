import type { Metadata } from "next";

import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

import { unblockDate } from "./actions";
import { BlockDateForm } from "./blocked-dates";
import { HoursForm, type DayWindow } from "./hours-form";

export const metadata: Metadata = { title: "Hours" };

/** Today's date in her timezone, as YYYY-MM-DD. */
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

function formatBlockedDate(value: string): string {
  // Parse as a plain calendar date; no timezone shifting.
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default async function HoursPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const today = todayIn(profile.timezone);

  const [availabilityResult, blockedResult] = await Promise.all([
    supabase
      .from("availability")
      .select("weekday, start_minute, end_minute")
      .eq("profile_id", profile.id)
      .order("weekday", { ascending: true }),
    supabase
      .from("blocked_dates")
      .select("id, blocked_on, note")
      .eq("profile_id", profile.id)
      .gte("blocked_on", today)
      .order("blocked_on", { ascending: true }),
  ]);

  const initial: Record<number, DayWindow | undefined> = {};
  for (const row of availabilityResult.data ?? []) {
    // The editor shows one window per day, so keep the earliest.
    if (!initial[row.weekday]) {
      initial[row.weekday] = {
        start_minute: row.start_minute,
        end_minute: row.end_minute,
      };
    }
  }

  const blocked = blockedResult.data ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-labelledby="hours-h">
        <h1 id="hours-h" className="font-serif text-[40px] leading-none">
          Hours
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          The days and times clients can book. Shown in{" "}
          <strong>{profile.timezone}</strong>, which you can change on the
          Profile tab.
        </p>

        {availabilityResult.error && (
          <p className="mt-6 rounded-[14px] bg-butter px-4 py-3 text-[15px]">
            Couldn&rsquo;t load your hours: {availabilityResult.error.message}
          </p>
        )}

        <HoursForm initial={initial} />
      </section>

      <section aria-labelledby="blocked-h" className="card lg:sticky lg:top-6">
        <h2 id="blocked-h" className="font-serif text-[28px] leading-none">
          Time off
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          Block a whole day and nobody can book it, even during your usual
          hours.
        </p>

        <BlockDateForm today={today} />

        <div className="mt-6 border-t border-line pt-4">
          <h3 className="text-[14px] font-bold">Coming up</h3>

          {blocked.length === 0 ? (
            <p className="hint">No days blocked.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {blocked.map((date) => (
                <li
                  key={date.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold">
                      {formatBlockedDate(date.blocked_on)}
                    </span>
                    {date.note && (
                      <span className="block truncate text-[13px] text-muted">
                        {date.note}
                      </span>
                    )}
                  </span>

                  <form action={unblockDate}>
                    <input type="hidden" name="id" value={date.id} />
                    <button
                      type="submit"
                      className="text-[13px] font-semibold text-cherry underline underline-offset-4"
                    >
                      Unblock
                      <span className="sr-only">
                        {" "}
                        {formatBlockedDate(date.blocked_on)}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
