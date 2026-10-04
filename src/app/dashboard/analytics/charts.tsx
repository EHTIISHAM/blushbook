import type { TrendPoint, TrendUnit } from "@/lib/analytics";
import { WEEKDAYS } from "@/lib/format";

/** Monday first, the way a working week reads. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function hourLabel(hour: number): string {
  const suffix = hour < 12 || hour === 24 ? "am" : "pm";
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

function bucketLabel(start: string, unit: TrendUnit): string {
  const [y, m, d] = start.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    ...(unit === "month"
      ? { month: "short", year: "2-digit" }
      : { day: "numeric", month: "short" }),
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * One line of bookings over time. The line and area are SVG stretched to the
 * box; the dots and labels are HTML so they stay round and readable at any
 * width.
 */
export function TrendChart({
  points,
  unit,
}: {
  points: TrendPoint[];
  unit: TrendUnit;
}) {
  const max = Math.max(1, ...points.map((point) => point.bookings));
  // A little headroom so the top dot isn't clipped.
  const top = max * 1.1;
  const x = (index: number) =>
    points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
  const y = (value: number) => 100 - (value / top) * 100;

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.bookings)}`)
    .join(" ");
  const area = `${line} L100,100 L0,100 Z`;

  const per = unit === "day" ? "day" : unit === "week" ? "week" : "month";
  const last = points.length - 1;
  // Deduped: with one or two points the first, middle and last collide.
  const labelled = [...new Set([0, Math.floor(last / 2), last])];

  return (
    <figure className="mt-4">
      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
        <div className="relative text-right text-[12px] text-muted tabular-nums">
          <span className="absolute right-0" style={{ top: `${y(max)}%`, transform: "translateY(-50%)" }}>
            {max}
          </span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
        </div>

        <div className="relative h-44">
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {[y(max), 100].map((value) => (
              <line
                key={value}
                x1="0"
                x2="100"
                y1={value}
                y2={value}
                stroke="var(--line)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} fill="color-mix(in srgb, var(--accent) 12%, transparent)" />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {points.map((point, index) => (
            <span
              key={point.start}
              title={`${bucketLabel(point.start, unit)}: ${point.bookings} booking${point.bookings === 1 ? "" : "s"}`}
              className="group absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
              style={{ left: `${x(index)}%`, top: `${y(point.bookings)}%` }}
            >
              <span
                className={`block h-2 w-2 rounded-full bg-accent ring-2 ring-paper group-hover:h-3 group-hover:w-3 ${
                  points.length > 16 ? "opacity-0 group-hover:opacity-100" : ""
                }`}
              />
            </span>
          ))}
        </div>

        <div />
        <div className="relative h-4 text-[12px] text-muted">
          {labelled.map((index) => (
            <span
              key={index}
              className="absolute whitespace-nowrap"
              style={{
                left: `${x(index)}%`,
                transform:
                  last === 0
                    ? "translateX(-50%)"
                    : index === 0
                      ? "none"
                      : index === last
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
              }}
            >
              {bucketLabel(points[index].start, unit)}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="sr-only">
        <table>
          <caption>Bookings per {per}</caption>
          <tbody>
            {points.map((point) => (
              <tr key={point.start}>
                <th scope="row">{bucketLabel(point.start, unit)}</th>
                <td>{point.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/**
 * Bookings by weekday and two-hour block. One hue, pale to deep: more
 * bookings, deeper accent.
 */
export function DayTimeHeatmap({
  grid,
  firstHour,
  lastHour,
}: {
  /** [weekday][hour] booking counts. */
  grid: number[][];
  /** First hour shown, inclusive. */
  firstHour: number;
  /** Last hour shown, exclusive. */
  lastHour: number;
}) {
  const start = Math.floor(firstHour / 2) * 2;
  const blocks: number[] = [];
  for (let hour = start; hour < lastHour; hour += 2) blocks.push(hour);

  const cell = (weekday: number, hour: number) =>
    grid[weekday][hour] + (hour + 1 < 24 ? grid[weekday][hour + 1] : 0);
  const max = Math.max(
    1,
    ...blocks.flatMap((hour) => WEEK_ORDER.map((weekday) => cell(weekday, hour))),
  );

  return (
    <div className="mt-4">
      <table className="w-full table-fixed border-separate border-spacing-[2px] text-[12px]">
        <thead>
          <tr>
            <th className="w-11" />
            {WEEK_ORDER.map((weekday) => (
              <th key={weekday} scope="col" className="pb-1 font-semibold text-muted">
                {WEEKDAYS[weekday].slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocks.map((hour) => (
            <tr key={hour}>
              <th
                scope="row"
                className="whitespace-nowrap pr-1 text-left font-normal text-muted"
              >
                {hourLabel(hour)}
              </th>
              {WEEK_ORDER.map((weekday) => {
                const count = cell(weekday, hour);
                const label = `${WEEKDAYS[weekday]} ${hourLabel(hour)}–${hourLabel(hour + 2)}: ${count} booking${count === 1 ? "" : "s"}`;
                return (
                  <td
                    key={weekday}
                    title={label}
                    className="h-6 rounded-[4px] hover:outline-2 hover:outline-ink"
                    style={{
                      background:
                        count === 0
                          ? "var(--bubble)"
                          : `color-mix(in srgb, var(--accent) ${Math.round(15 + (count / max) * 85)}%, var(--bubble))`,
                    }}
                  >
                    <span className="sr-only">{label}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden className="mt-2 flex items-center justify-end gap-2 text-[12px] text-muted">
        Fewer
        <span
          className="h-2.5 w-20 rounded-full"
          style={{
            background:
              "linear-gradient(to right, var(--bubble), color-mix(in srgb, var(--accent) 15%, var(--bubble)), var(--accent))",
          }}
        />
        More
      </div>
    </div>
  );
}
