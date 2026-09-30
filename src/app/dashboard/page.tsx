import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMoney } from "@/lib/format";
import { getSessionProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { BookingRow } from "@/lib/supabase/database.types";

import { BookingStatusButtons } from "./booking-status";

/** How far back the Past list reaches. Older bookings still count in analytics. */
const PAST_DAYS = 90;

type ListedBooking = Pick<
  BookingRow,
  | "id"
  | "client_name"
  | "client_contact"
  | "contact_kind"
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
                  <span className="ml-2 rounded-full bg-champagne px-2 py-0.5 align-middle text-[12px] font-semibold">
                    {flag}
                  </span>
                )}
              </p>
              <p className="text-[14px] text-muted">
                {booking.service_name} &middot;{" "}
                {formatMoney(booking.price_cents, currency)} &middot;{" "}
                {booking.contact_kind === "whatsapp" ? "WhatsApp" : "Instagram"}{" "}
                {booking.client_contact}
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
  href: string;
  cta: string;
}

export default async function BookingsPage() {
  const { profile } = await getSessionProfile();

  if (!profile) {
    return (
      <div className="card max-w-[640px]">
        <h1 className="font-display text-[22px] leading-none">
          Your studio isn&rsquo;t set up yet
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          You&rsquo;re logged in, but there&rsquo;s no profile row for this
          account. That happens when the database migration in{" "}
          <code className="rounded bg-bubble px-1.5 py-0.5 text-[13px]">
            supabase/migrations
          </code>{" "}
          hasn&rsquo;t been applied yet, so the signup trigger never ran. Apply
          it, then log out and back in.
        </p>
      </div>
    );
  }

  // A brand-new account lands here straight from its first magic link. Send it
  // through setup once; naming the studio is what marks that as done, so this
  // cannot bounce her back after she has started.
  if (!profile.business_name.trim()) {
    redirect("/welcome");
  }

  const supabase = await createClient();

  const now = new Date();
  const pastFrom = new Date(now.getTime() - PAST_DAYS * 24 * 60 * 60 * 1000);
  const bookingColumns =
    "id, client_name, client_contact, contact_kind, starts_at, status, service_name, price_cents";

  const [services, availability, upcomingResult, pastResult] = await Promise.all([
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
  ]);

  const upcoming: ListedBooking[] = upcomingResult.data ?? [];
  const past: ListedBooking[] = pastResult.data ?? [];
  const loadError = upcomingResult.error ?? pastResult.error;

  const checklist: ChecklistItem[] = [
    {
      label: "Name your studio and claim your link",
      done: profile.business_name.trim().length > 0,
      href: "/dashboard/profile",
      cta: "Profile",
    },
    {
      label: "Add at least one service",
      done: (services.count ?? 0) > 0,
      href: "/dashboard/services",
      cta: "Services",
    },
    {
      label: "Set the days and times you work",
      done: (availability.count ?? 0) > 0,
      href: "/dashboard/hours",
      cta: "Hours",
    },
    // No deposit item here for now: setup does not ask for deposits, so the
    // checklist should not be the thing that reintroduces the prompt.
    {
      label: "Write your no-show policy",
      done: Boolean(profile.no_show_policy),
      href: "/dashboard/profile",
      cta: "Profile",
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

        {loadError && (
          <p className="mt-6 rounded-[14px] bg-champagne px-4 py-3 text-[15px]">
            Couldn&rsquo;t load your bookings: {loadError.message}
          </p>
        )}

        {!loadError && upcoming.length === 0 && past.length === 0 && (
          <div className="mt-6 rounded-[26px] bg-petal px-6 py-10 text-center">
            <p className="font-display text-[18px] leading-tight">
              No bookings yet
            </p>
            <p className="mx-auto mt-2 max-w-[38ch] text-[15px] text-muted">
              Share your link and new bookings will show up here.
            </p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mt-6">
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
            <h2 className="text-[15px] font-bold">
              Past {PAST_DAYS} days
            </h2>
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

      <section aria-labelledby="setup-h" className="card lg:sticky lg:top-6">
        <h2 id="setup-h" className="font-display text-[19px] leading-none">
          Get set up
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          {remaining === 0
            ? "All done. Your page has everything it needs."
            : `${remaining} thing${remaining === 1 ? "" : "s"} left.`}
        </p>

        <ul className="mt-5 grid gap-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-bold ${
                  item.done
                    ? "bg-rose text-rose-ink"
                    : "bg-bubble text-muted"
                }`}
              >
                {item.done ? "✓" : ""}
              </span>

              <span className="min-w-0 flex-1 text-[15px]">
                <span className={item.done ? "text-muted line-through" : ""}>
                  {item.label}
                </span>
                {!item.done && (
                  <Link
                    href={item.href}
                    className="ml-2 whitespace-nowrap text-[14px] font-semibold text-rose underline underline-offset-4"
                  >
                    {item.cta}
                  </Link>
                )}
                <span className="sr-only">
                  {item.done ? " — done" : " — not done yet"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
