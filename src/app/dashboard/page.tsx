import Link from "next/link";
import { redirect } from "next/navigation";

import {
  findFollowUps,
  followUpMessage,
  whatsappLink,
  type FollowUpBooking,
} from "@/lib/follow-ups";
import { formatMoney } from "@/lib/format";
import { getSessionProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { BookingRow } from "@/lib/supabase/database.types";

import { BookingStatusButtons } from "./booking-status";
import { FollowUps, type FollowUpItem } from "./follow-ups";
import { CopyField } from "./share/copy-field";

/** How far back the Past list reaches. Older bookings still count in analytics. */
const PAST_DAYS = 90;

/** How far back follow-ups look for a client's visit pattern. */
const PATTERN_DAYS = 365;

const DAY = 24 * 60 * 60 * 1000;

type ListedBooking = Pick<
  BookingRow,
  | "id"
  | "client_name"
  | "client_contact"
  | "contact_kind"
  | "client_email"
  | "starts_at"
  | "status"
  | "service_name"
  | "price_cents"
>;

const STATUS_LABELS: Partial<Record<BookingRow["status"], string>> = {
  cancelled: "Cancelled",
  no_show: "No-show",
};

function formatWhen(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function BookingList({
  bookings,
  isPast,
  timezone,
  currency,
}: {
  bookings: ListedBooking[];
  isPast: boolean;
  timezone: string;
  currency: string;
}) {
  return (
    <ul className="mt-3 grid gap-2">
      {bookings.map((booking) => {
        const when = formatWhen(booking.starts_at, timezone);
        const flag = STATUS_LABELS[booking.status];

        return (
          <li
            key={booking.id}
            className={`card flex flex-wrap items-center justify-between gap-3 !py-4 ${
              flag ? "opacity-70" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-muted">{when}</p>
              <p className="mt-0.5 text-[16px] font-bold">
                {booking.client_name}
                {flag && (
                  <span className="ml-2 rounded-full bg-notice px-2 py-0.5 align-middle text-[12px] font-semibold">
                    {flag}
                  </span>
                )}
              </p>
              <p className="text-[14px] text-muted">
                {booking.service_name} &middot;{" "}
                {formatMoney(booking.price_cents, currency)} &middot;{" "}
                {/* Older bookings may still carry an Instagram handle. */}
                {booking.contact_kind === "instagram" && "Instagram "}
                {booking.client_contact}
                {booking.client_email && <> &middot; {booking.client_email}</>}
              </p>
            </div>

            <BookingStatusButtons
              id={booking.id}
              status={booking.status}
              isPast={isPast}
              description={`${booking.client_name}, ${when}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

interface ChecklistItem {
  label: string;
  done: boolean;
  actions: { href: string; cta: string }[];
}

export default async function BookingsPage() {
  const { profile } = await getSessionProfile();

  if (!profile) {
    return (
      <div className="card max-w-[640px]">
        <h1 className="font-display text-[22px] leading-none">
          We couldn&rsquo;t load your account
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          Something went wrong setting up your account. Log out and back in,
          and if it keeps happening, contact support.
        </p>
      </div>
    );
  }

  // A brand-new account lands here straight from its first sign-in. Send it
  // through setup once; naming the business is what marks that as done, so
  // this cannot bounce anyone back after they have started.
  if (!profile.business_name.trim()) {
    redirect("/welcome");
  }

  const supabase = await createClient();

  const now = new Date();
  const pastFrom = new Date(now.getTime() - PAST_DAYS * DAY);
  const patternFrom = new Date(now.getTime() - PATTERN_DAYS * DAY);
  const bookingColumns =
    "id, client_name, client_contact, contact_kind, client_email, starts_at, status, service_name, price_cents";

  const [services, availability, upcomingResult, pastResult, historyResult] =
    await Promise.all([
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("is_active", true),
      supabase
        .from("availability")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id),
      supabase
        .from("bookings")
        .select(bookingColumns)
        .eq("profile_id", profile.id)
        .gte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(200),
      supabase
        .from("bookings")
        .select(bookingColumns)
        .eq("profile_id", profile.id)
        .lt("starts_at", now.toISOString())
        .gte("starts_at", pastFrom.toISOString())
        .order("starts_at", { ascending: false })
        .limit(200),
      supabase
        .from("bookings")
        .select(
          "id, client_name, client_contact, contact_kind, starts_at, status, service_name",
        )
        .eq("profile_id", profile.id)
        .gte("starts_at", patternFrom.toISOString())
        .order("starts_at", { ascending: true })
        .limit(5000),
    ]);

  const upcoming: ListedBooking[] = upcomingResult.data ?? [];
  const past: ListedBooking[] = pastResult.data ?? [];
  const loadError = upcomingResult.error ?? pastResult.error;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://booknbloom.app")
    .replace(/\/$/, "");
  const bookingUrl = `${base}/${profile.slug}`;

  const dayFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: profile.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const history: FollowUpBooking[] = historyResult.data ?? [];
  const followUps: FollowUpItem[] = findFollowUps(history, now).map((item) => {
    const when = dayFormat.format(new Date(item.at));
    const message = followUpMessage(item, profile.business_name, bookingUrl, when);

    return {
      id: item.id,
      kind: item.kind,
      title: item.clientName,
      detail:
        item.kind === "no_show"
          ? `Missed ${item.serviceName} on ${when}.`
          : `Usually books every ${item.usualGapDays} days. Last visit was ${item.daysSince} days ago, for ${item.serviceName}.`,
      message,
      href: whatsappLink(item.phone, message),
    };
  });

  const hasServices = (services.count ?? 0) > 0;
  const hasHours = (availability.count ?? 0) > 0;

  const checklist: ChecklistItem[] = [
    {
      label: "Add your business name",
      done: profile.business_name.trim().length > 0,
      actions: [{ href: "/dashboard/profile", cta: "Profile" }],
    },
    {
      label: "Upload your rate card or add services",
      done: hasServices,
      actions: [
        { href: "/dashboard/services#scan-h", cta: "Upload rate card" },
        { href: "/dashboard/services", cta: "Add your first service" },
      ],
    },
    {
      label: "Set your working hours",
      done: hasHours,
      actions: [{ href: "/dashboard/hours", cta: "Set your hours" }],
    },
    // Payment links are switched off for now: clients pay at the business.
    // {
    //   label: "Add a payment or deposit link",
    //   done: Boolean(profile.deposit_link),
    //   actions: [{ href: "/dashboard/profile", cta: "Add payment link" }],
    // },
    {
      label: "Add your no-show and cancellation policy",
      done: Boolean(profile.no_show_policy),
      actions: [{ href: "/dashboard/profile", cta: "Add policy" }],
    },
  ];

  const remaining = checklist.filter((item) => !item.done).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-labelledby="bookings-h">
        <h1 id="bookings-h" className="font-display text-[27px] leading-none">
          Bookings
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Every booking made through your link lands here.
        </p>

        <div className="mt-6">
          <FollowUps items={followUps} />
        </div>

        {loadError && (
          <p className="rounded-[14px] bg-notice px-4 py-3 text-[15px]">
            Couldn&rsquo;t load your bookings. Please refresh the page.
          </p>
        )}

        {!loadError && upcoming.length === 0 && past.length === 0 && (
          <div className="rounded-[26px] bg-tint px-6 py-10 text-center">
            <p className="font-display text-[18px] leading-tight">
              No bookings yet
            </p>
            <p className="mx-auto mt-2 max-w-[38ch] text-[15px] text-muted">
              Share your link and new bookings will show up here.
            </p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <h2 className="text-[15px] font-bold">Coming up</h2>
            <p className="hint">
              Cancelling frees the time on your page. The client isn&rsquo;t
              told, so message them yourself.
            </p>
            <BookingList
              bookings={upcoming}
              isPast={false}
              timezone={profile.timezone}
              currency={profile.currency}
            />
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[15px] font-bold">Past {PAST_DAYS} days</h2>
            <p className="hint">
              These count as done. Mark any that didn&rsquo;t happen so your
              numbers stay right.
            </p>
            <BookingList
              bookings={past}
              isPast
              timezone={profile.timezone}
              currency={profile.currency}
            />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:sticky lg:top-6">
        <section aria-labelledby="setup-h" className="card">
          <h2 id="setup-h" className="font-display text-[19px] leading-none">
            {remaining === 0 ? "You’re set up" : "Get set up"}
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            {remaining === 0
              ? "Your booking page has everything it needs."
              : `${remaining} step${remaining === 1 ? "" : "s"} left.`}
          </p>

          <ol className="mt-5 grid gap-4">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-bold ${
                    item.done ? "bg-accent text-accent-ink" : "bg-bubble text-muted"
                  }`}
                >
                  {item.done ? "✓" : ""}
                </span>

                <span className="min-w-0 flex-1 text-[15px]">
                  <span className={item.done ? "text-muted line-through" : ""}>
                    {item.label}
                  </span>
                  <span className="sr-only">
                    {item.done ? " — done" : " — not done yet"}
                  </span>
                  {!item.done && (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {item.actions.map((action) => (
                        <Link key={action.cta} href={action.href} className="btn btn-sm">
                          {action.cta}
                        </Link>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="live-h" className="card">
          <h2 id="live-h" className="font-display text-[19px] leading-none">
            Go live
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            {hasServices && hasHours
              ? "Your page is taking bookings. Check it over, then send it to clients."
              : "Once you have a service and your hours, your page starts taking bookings."}
          </p>

          <div className="mt-4 grid gap-4">
            <a
              className="btn btn-ghost btn-sm"
              href={`/${profile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preview booking page
            </a>
            <CopyField label="Copy booking link" value={bookingUrl} />
            <Link className="btn btn-sm" href="/dashboard/share">
              Share with clients
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
