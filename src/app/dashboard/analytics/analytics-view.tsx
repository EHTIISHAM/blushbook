import Link from "next/link";

import type { Analytics, Slot, TrendPoint, TrendUnit, Window } from "@/lib/analytics";
import { formatDuration, formatMoney, WEEKDAYS } from "@/lib/format";

import { DayTimeHeatmap, hourLabel, TrendChart } from "./charts";
export const PERIODS = {
  "30d": { label: "30 days", days: 30, unit: "day" },
  "90d": { label: "90 days", days: 90, unit: "week" },
  "12m": { label: "12 months", days: 365, unit: "month" },
} as const satisfies Record<string, { label: string; days: number; unit: TrendUnit }>;

export type PeriodKey = keyof typeof PERIODS;

/** Clients with no visit for this long count as due to rebook. */
export const LAPSED_AFTER_DAYS = 60;

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function hoursLabel(minutes: number): string {
  return formatDuration(Math.round(minutes / 15) * 15);
}

function slotLabel(slot: Slot): string {
  return `${WEEKDAYS[slot.weekday]} ${hourLabel(slot.hour)}–${hourLabel(slot.hour + 1)}`;
}

/** "↑ 12%" style change against the previous period, or null if unknown. */
function change(
  current: number | null,
  previous: number | null,
  kind: "relative" | "points",
): { text: string; direction: "up" | "down" | "flat" } | null {
  if (current === null || previous === null) return null;

  const delta =
    kind === "points"
      ? Math.round((current - previous) * 100)
      : previous === 0
        ? null
        : Math.round(((current - previous) / previous) * 100);
  if (delta === null) return null;

  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const unit = kind === "relative" ? "%" : Math.abs(delta) === 1 ? " pt" : " pts";
  return { text: `${arrow} ${Math.abs(delta)}${unit}`, direction };
}

function Stat({
  label,
  value,
  note,
  delta,
  goodWhen = "up",
  tone = "paper",
}: {
  label: string;
  value: string;
  note?: string;
  delta?: ReturnType<typeof change>;
  /** Which way is good news, so a falling no-show rate reads as good. */
  goodWhen?: "up" | "down";
  tone?: "paper" | "tint" | "notice";
}) {
  const good = delta && delta.direction !== "flat" && delta.direction === goodWhen;
  const bg =
    tone === "tint" ? "bg-tint" : tone === "notice" ? "bg-notice" : "bg-paper";

  return (
    <div className={`rounded-[22px] p-4 shadow-[inset_0_0_0_1.5px_var(--line)] ${bg}`}>
      <p className="font-display text-[26px] leading-none">{value}</p>
      <p className="mt-1.5 text-[14px] font-semibold">{label}</p>
      {delta && (
        <p className="mt-2 text-[13px]">
          <span className={`font-bold ${good ? "text-ink" : "text-muted"}`}>
            {delta.text}
          </span>{" "}
          <span className="text-muted">
            {good ? "better than" : delta.direction === "flat" ? "same as" : "vs."} last
            period
          </span>
        </p>
      )}
      {note && <p className="hint">{note}</p>}
    </div>
  );
}

function Card({
  id,
  title,
  children,
  className = "",
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`card ${className}`}>
      <h2 id={id} className="font-display text-[19px] leading-none">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ServiceRows({
  services,
  max,
  money,
}: {
  services: Analytics["services"];
  max: number;
  money: (cents: number) => string;
}) {
  return (
    <ol className="mt-3 grid gap-3">
      {services.map((service) => (
        <li key={service.name} className="text-[14px]">
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate font-semibold">{service.name}</span>
            <span className="whitespace-nowrap text-muted tabular-nums">
              {service.bookings} &middot; {money(service.revenueCents)}
            </span>
          </div>
          <span aria-hidden className="mt-1 block h-2 overflow-hidden rounded-full bg-bubble">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${(service.bookings / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

export function AnalyticsView({
  periodKey,
  stats,
  previous,
  trend,
  availability,
  timezone,
  currency,
  loadError,
}: {
  periodKey: PeriodKey;
  stats: Analytics;
  previous: Analytics | null;
  trend: TrendPoint[];
  availability: Window[];
  timezone: string;
  currency: string;
  loadError: string | null;
}) {
  const period = PERIODS[periodKey];

  const money = (cents: number | null) =>
    cents === null ? "—" : formatMoney(cents, currency);

  const returningShare = (a: Analytics | null) =>
    a && a.clients > 0 ? a.returningClients / a.clients : null;

  // Heatmap rows: the open hours, stretched to cover any booking outside them.
  const hours = [
    ...availability.flatMap((w) => [
      Math.floor(w.start_minute / 60),
      Math.ceil(w.end_minute / 60),
    ]),
    ...stats.byHour.flatMap((count, hour) => (count > 0 ? [hour, hour + 1] : [])),
  ];
  const firstHour = hours.length ? Math.min(...hours) : 9;
  const lastHour = hours.length ? Math.max(...hours) : 19;

  const attendedTotal = stats.bookings + stats.noShows + stats.cancellations;
  const topServices = stats.services.slice(0, 5);
  const leastServices =
    // The bottom three, never repeating one already listed as most popular.
    stats.services.slice(Math.max(5, stats.services.length - 3)).reverse();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[27px] leading-none">Analytics</h1>
          <p className="mt-2 text-[15px] text-muted">
            How your last {period.label} went.
          </p>
        </div>

        <nav aria-label="Period" className="flex gap-1 rounded-full bg-bubble p-1">
          {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
            <Link
              key={key}
              href={`/dashboard/analytics?period=${key}`}
              aria-current={key === periodKey ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[14px] font-semibold no-underline ${
                key === periodKey ? "bg-paper text-ink shadow-sm" : "text-muted"
              }`}
            >
              {PERIODS[key].label}
            </Link>
          ))}
        </nav>
      </div>

      {loadError && (
        <p className="mt-6 rounded-[14px] bg-notice px-4 py-3 text-[15px]">
          Couldn&rsquo;t load everything: {loadError}
        </p>
      )}

      {stats.bookings === 0 && !loadError && (
        <div className="mt-6 rounded-[26px] bg-tint px-6 py-8 text-center">
          <p className="font-display text-[18px] leading-tight">Nothing to show yet</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[15px] text-muted">
            Once clients have been in, their bookings fill in these numbers.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          tone="tint"
          label="Revenue"
          value={money(stats.revenueCents)}
          delta={previous && change(stats.revenueCents, previous.revenueCents, "relative")}
        />
        <Stat
          tone="tint"
          label="Bookings"
          value={String(stats.bookings)}
          delta={previous && change(stats.bookings, previous.bookings, "relative")}
        />
        <Stat
          tone="notice"
          label="No-show rate"
          value={percent(stats.noShowRate)}
          goodWhen="down"
          delta={previous && change(stats.noShowRate, previous.noShowRate, "points")}
        />
        <Stat
          tone="notice"
          label="Returning clients"
          value={percent(returningShare(stats))}
          delta={
            previous && change(returningShare(stats), returningShare(previous), "points")
          }
        />
      </div>
      <p className="hint">Revenue is at the prices clients booked at.</p>

      <Card id="trend-h" title="Bookings trend" className="mt-6">
        <p className="hint">
          Per {period.unit}. Hover a point for its count.
        </p>
        <TrendChart points={trend} unit={period.unit} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="services-h" title="Services">
          {topServices.length === 0 ? (
            <p className="hint">No bookings in this period.</p>
          ) : (
            <>
              <h3 className="mt-4 text-[13px] font-bold text-muted">Most popular</h3>
              <ServiceRows
                services={topServices}
                max={topServices[0].bookings}
                money={money}
              />
              {leastServices.length > 0 && (
                <>
                  <h3 className="mt-5 text-[13px] font-bold text-muted">
                    Least popular
                  </h3>
                  <ServiceRows
                    services={leastServices}
                    max={topServices[0].bookings}
                    money={money}
                  />
                </>
              )}
              <p className="hint mt-4">
                Services nobody booked in this period don&rsquo;t appear.
              </p>
            </>
          )}
        </Card>

        <Card id="busy-h" title="Bookings by day & time">
          <DayTimeHeatmap
            grid={stats.byWeekdayHour}
            firstHour={firstHour}
            lastHour={lastHour}
          />
          <dl className="mt-4 grid gap-1 rounded-[14px] bg-bubble px-4 py-3 text-[14px]">
            <div className="flex gap-2">
              <dt className="font-bold">Busiest:</dt>
              <dd>{stats.busiestSlot ? slotLabel(stats.busiestSlot) : "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold">Quietest:</dt>
              <dd>
                {stats.quietestSlot ? slotLabel(stats.quietestSlot) : "Set your hours first"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="clients-h" title="Clients">
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Clients" value={String(stats.clients)} />
            <Stat
              label="Average spend"
              value={money(stats.averageSpendCents)}
              delta={
                previous &&
                change(stats.averageSpendCents, previous.averageSpendCents, "relative")
              }
            />
            <Stat
              label="New"
              value={String(stats.newClients)}
              note="First visit in this period"
            />
            <Stat
              label="Returning"
              value={String(stats.returningClients)}
              note={`${percent(stats.repeatRate)} have been twice or more`}
            />
          </div>
          <p className="hint">
            Clients are matched by the phone number they book with.
          </p>
        </Card>

        <Card id="attendance-h" title="Attendance">
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Attended" value={percent(attendedTotal ? stats.bookings / attendedTotal : null)} note={String(stats.bookings)} />
            <Stat label="No-shows" value={percent(attendedTotal ? stats.noShows / attendedTotal : null)} note={String(stats.noShows)} />
            <Stat label="Cancelled" value={percent(stats.cancellationRate)} note={String(stats.cancellations)} />
          </div>
          <p className="hint">
            Mark no-shows and cancellations on the{" "}
            <Link
              href="/dashboard"
              className="font-semibold text-accent underline underline-offset-4"
            >
              Bookings
            </Link>{" "}
            tab. Anything not marked counts as attended.
          </p>
        </Card>
      </div>

      <Card id="actions-h" title="Worth acting on" className="mt-6">
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          <li className="rounded-[18px] bg-tint p-4">
            <p className="text-[15px] font-bold">
              {stats.lapsed.length} client{stats.lapsed.length === 1 ? "" : "s"} due to
              rebook
            </p>
            <p className="mt-1 text-[14px] text-muted">
              No visit in {LAPSED_AFTER_DAYS} days and nothing booked.{" "}
              {stats.lapsed.length > 0 && (
                <a href="#lapsed-h" className="font-semibold text-accent underline underline-offset-4">
                  See who
                </a>
              )}
            </p>
          </li>
          <li className="rounded-[18px] bg-tint p-4">
            <p className="text-[15px] font-bold">
              {stats.quietestSlot ? `Quiet ${slotLabel(stats.quietestSlot)}` : "No quiet time found"}
            </p>
            <p className="mt-1 text-[14px] text-muted">
              Your emptiest open hour. A good time to offer a deal.
            </p>
          </li>
          <li className="rounded-[18px] bg-tint p-4">
            <p className="text-[15px] font-bold">
              {money(
                stats.estimatedLostCents === null
                  ? null
                  : Math.round(stats.estimatedLostCents / 100) * 100,
              )}{" "}
              of empty time
            </p>
            <p className="mt-1 text-[14px] text-muted">
              {hoursLabel(stats.emptyMinutes)} unbooked, valued at what your
              booked hours earn. An estimate.
            </p>
          </li>
        </ul>
      </Card>

      <Card id="time-h" title="Your time" className="mt-6">
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Booked"
            value={percent(stats.utilisation)}
            note="Of your open hours"
            delta={previous && change(stats.utilisation, previous.utilisation, "points")}
          />
          <Stat label="Hours booked" value={hoursLabel(stats.bookedMinutes)} />
          <Stat label="Hours empty" value={hoursLabel(stats.emptyMinutes)} />
          <Stat label="Hours open" value={hoursLabel(stats.openMinutes)} />
        </div>
        <p className="hint">
          Open hours use your current weekly hours and days off. Today
          isn&rsquo;t counted until it&rsquo;s over.
        </p>
      </Card>

      <Card id="lapsed-h" title="Due to rebook" className="mt-6">
        <p className="hint">
          Regulars first, since they&rsquo;re most worth a message.
        </p>
        {stats.lapsed.length === 0 ? (
          <p className="mt-3 text-[14px]">Nobody yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {stats.lapsed.slice(0, 25).map((client) => (
              <li
                key={`${client.contactKind}:${client.contact}`}
                className="flex flex-wrap justify-between gap-x-3 text-[14px]"
              >
                <span className="font-semibold">
                  {client.name}{" "}
                  <span className="font-normal text-muted">
                    {client.contactKind === "instagram" && "Instagram "}
                    {client.contact}
                  </span>
                </span>
                <span className="text-muted">
                  {client.visits} visit{client.visits === 1 ? "" : "s"} &middot; last{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: timezone,
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(client.lastVisit))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {stats.lapsed.length > 25 && (
          <p className="hint">And {stats.lapsed.length - 25} more.</p>
        )}
      </Card>
    </div>
  );
}
