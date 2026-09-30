import { formatDuration, USUAL_DURATIONS } from "@/lib/format";

/**
 * One tap to pick her usual appointment length. Posts as
 * default_duration_minutes. A length she set some other way than these chips
 * is kept as an extra chip so it never silently changes.
 */
export function UsualDurationPicker({
  value,
  idPrefix = "usual",
}: {
  value: number;
  idPrefix?: string;
}) {
  const options = USUAL_DURATIONS.includes(value)
    ? USUAL_DURATIONS
    : [...USUAL_DURATIONS, value].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((minutes) => {
        const id = `${idPrefix}-${minutes}`;
        return (
          <span key={minutes} className="relative inline-flex">
            <input
              id={id}
              type="radio"
              name="default_duration_minutes"
              value={minutes}
              defaultChecked={minutes === value}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <label
              htmlFor={id}
              className="cursor-pointer rounded-full bg-paper px-4 py-2 text-[14px] font-semibold text-muted shadow-[inset_0_0_0_1.5px_var(--line)] peer-checked:bg-rose peer-checked:text-rose-ink peer-checked:shadow-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rose"
            >
              {formatDuration(minutes)}
            </label>
          </span>
        );
      })}
    </div>
  );
}
