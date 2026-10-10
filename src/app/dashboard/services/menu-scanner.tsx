"use client";

import { startTransition, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { IDLE } from "@/lib/action-state";
import { formatDuration } from "@/lib/format";
import { SECTORS, SECTOR_DEFAULTS, isSector, type Sector } from "@/lib/timing-rules";

import {
  importServices,
  scanMenu,
  type ScannedService,
  type ScanState,
} from "./actions";

const MAX_PHOTOS = 4;
// Long edge after shrinking. Enough for small print on a phone photo of an
// A4 menu, and keeps four photos well inside the upload limit.
const MAX_EDGE = 2000;

const SCAN_IDLE: ScanState = { status: "idle" };

/** Re-encodes a phone photo as a JPEG no larger than MAX_EDGE on its long side. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/jpeg",
      0.85,
    ),
  );
}

/* ------------------------------------------------------------------ */

export function MenuScanner({
  currency,
  usualMinutes,
  sector: savedSector,
}: {
  currency: string;
  usualMinutes: number;
  /** Her business type, which picks the timing rules services are matched to. */
  sector: Sector | null;
}) {
  const [scan, scanAction, scanning] = useActionState(scanMenu, SCAN_IDLE);
  const [sector, setSector] = useState<Sector | "">(savedSector ?? "");
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Each scan gets a number, so its review list starts fresh and an import
  // can close that list without affecting the next scan.
  const [scanId, setScanId] = useState(0);
  const [imported, setImported] = useState<{ scanId: number; message: string } | null>(null);

  async function onPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS);
    event.target.value = "";
    if (files.length === 0) return;

    setPhotoError(null);
    setImported(null);
    setPreparing(true);

    try {
      const formData = new FormData();
      formData.append("sector", sector);
      for (const file of files) {
        formData.append("photo", await shrink(file), "menu.jpg");
      }
      setScanId((value) => value + 1);
      startTransition(() => scanAction(formData));
    } catch {
      setPhotoError(
        "That photo format couldn't be opened here. Take a new photo, or save it as a JPG first.",
      );
    } finally {
      setPreparing(false);
    }
  }

  const busy = preparing || scanning;
  const error = photoError ?? (scan.status === "error" ? scan.message : null);

  return (
    <section aria-labelledby="scan-h" className="card">
      <h2 id="scan-h" className="font-display text-[19px] leading-none">
        Upload your rate card
      </h2>
      <p className="mt-2 text-[14px] text-muted">
        Upload a photo or screenshot of your rate card and we&rsquo;ll fill in
        your services. You check everything before it&rsquo;s added.
      </p>

      <div className="mt-4">
        <label className="label" htmlFor="scan-sector">
          Type of business
        </label>
        <select
          id="scan-sector"
          className="field"
          value={sector}
          onChange={(event) =>
            setSector(isSector(event.target.value) ? event.target.value : "")
          }
          disabled={busy}
        >
          <option value="">Not sure / other</option>
          {SECTORS.map((value) => (
            <option key={value} value={value}>
              {SECTOR_DEFAULTS[value].label}
            </option>
          ))}
        </select>
        <p className="hint">
          Where your rate card doesn&rsquo;t say how long something takes, we
          suggest a time for your type of business.
        </p>
      </div>

      <label
        className={`btn btn-sm mt-4 cursor-pointer ${busy ? "pointer-events-none opacity-45" : ""}`}
      >
        {preparing
          ? "Preparing photo…"
          : scanning
            ? "Reading your rate card…"
            : scan.status === "success"
              ? "Upload a different photo"
              : "Upload a photo or screenshot"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={onPhotos}
          disabled={busy}
        />
      </label>
      <p className="hint">
        Up to {MAX_PHOTOS} photos if your rate card has more than one page.
        {scanning && " This usually takes under a minute."}
      </p>

      {error && !busy && (
        <p className="mt-3 text-[14px] font-semibold text-accent" role="alert">
          {error}
        </p>
      )}

      {imported && !busy && (
        <p
          className="mt-5 rounded-[14px] bg-bubble px-4 py-3 text-[15px]"
          role="status"
        >
          {imported.message} They&rsquo;re at the bottom of your list.
        </p>
      )}

      {scan.status === "success" && !busy && imported?.scanId !== scanId && (
        <ReviewList
          key={scanId}
          services={scan.services}
          menuCurrency={scan.menuCurrency}
          currency={currency}
          usualMinutes={usualMinutes}
          onImported={(message) => setImported({ scanId, message })}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface Row {
  key: number;
  section: string;
  name: string;
  price: string;
  priceNote: string | null;
  minutes: string;
  buffer: number;
  step: number;
  /** Where the suggested minutes came from, for the hint under the row. */
  origin: string | null;
  /** Why the timing needs her check. Cleared once she changes the minutes. */
  review: string | null;
  include: boolean;
  duplicate: boolean;
}

function originOf(service: ScannedService): string | null {
  if (service.source === "rate_card") return "Time from your rate card";
  if (service.ruleName) return `Suggested time for ${service.ruleName.toLowerCase()}`;
  return null;
}

function ImportButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending || count === 0}>
      {pending
        ? "Adding…"
        : `Add ${count} service${count === 1 ? "" : "s"}`}
    </button>
  );
}

function ReviewList({
  services,
  menuCurrency,
  currency,
  usualMinutes,
  onImported,
}: {
  services: ScannedService[];
  menuCurrency: string | null;
  currency: string;
  usualMinutes: number;
  onImported: (message: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    services.map((service, key) => ({
      key,
      section: service.section,
      name: service.name,
      price: service.price,
      priceNote: service.priceNote,
      minutes: service.minutes === null ? "" : String(service.minutes),
      buffer: service.buffer,
      step: service.step,
      origin: originOf(service),
      review: service.review,
      // Anything already on her list starts unticked so a re-scan
      // doesn't double the list.
      include: !service.duplicate,
      duplicate: service.duplicate,
    })),
  );

  const [state, formAction] = useActionState(
    async (previous: typeof IDLE, formData: FormData) => {
      const result = await importServices(previous, formData);
      if (result.status === "success") onImported(result.message ?? "Added.");
      return result;
    },
    IDLE,
  );

  function update(key: number, change: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  }

  const chosen = rows.filter((row) => row.include);
  const allOn = chosen.length === rows.length;

  const payload = JSON.stringify(
    chosen.map((row) => ({
      section: row.section,
      name: row.name,
      price_cents: row.price.trim() === "" ? null : Number(row.price),
      duration_minutes: row.minutes.trim() === "" ? null : Number(row.minutes),
      buffer_minutes: row.buffer,
      slot_step_minutes: row.step,
      timing_review_note: row.review,
    })),
  );

  const toCheck = chosen.filter((row) => row.review).length;

  // Group under the menu's own headings, keeping the menu's order.
  const sections: { title: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const last = sections.at(-1);
    if (last && last.title === row.section) last.rows.push(row);
    else sections.push({ title: row.section, rows: [row] });
  }

  return (
    <form action={formAction} className="mt-6 border-t border-line pt-5">
      <input type="hidden" name="services" value={payload} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold">
          Found {rows.length} service{rows.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          className="text-[14px] font-semibold text-muted underline underline-offset-4"
          onClick={() =>
            setRows((current) =>
              current.map((row) => ({ ...row, include: !allOn })),
            )
          }
        >
          {allOn ? "Untick all" : "Tick all"}
        </button>
      </div>

      <p className="hint">
        Blank minutes use your usual length ({formatDuration(usualMinutes)}).
        Prices are in {currency}.
      </p>

      {toCheck > 0 && (
        <p className="mt-3 rounded-[14px] bg-notice px-4 py-3 text-[14px]">
          {toCheck} timing{toCheck === 1 ? " needs" : "s need"} checking. They
          are marked below. Change the minutes, or add them as they are and
          confirm them later on the Services page.
        </p>
      )}

      {menuCurrency && (
        <p className="mt-3 rounded-[14px] bg-notice px-4 py-3 text-[14px]">
          Your rate card looks like it&rsquo;s priced in {menuCurrency}, but your
          account uses {currency}. You can change that in Settings.
        </p>
      )}

      <div className="mt-4 grid gap-5">
        {sections.map((section, sectionIndex) => (
          <fieldset key={`${section.title}-${sectionIndex}`} className="border-0 p-0">
            <legend className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">
              {section.title || "Other"}
            </legend>

            <ul className="grid gap-2">
              {section.rows.map((row) => (
                <li
                  key={row.key}
                  className={`rounded-[14px] p-3 shadow-[inset_0_0_0_1.5px_var(--line)] ${
                    row.include ? "" : "opacity-55"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(event) =>
                        update(row.key, { include: event.target.checked })
                      }
                      className="mt-3 h-5 w-5 flex-none accent-[var(--accent)]"
                      aria-label={`Add ${row.name || "this service"}`}
                    />

                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_110px_90px]">
                      <input
                        className="field"
                        value={row.name}
                        maxLength={80}
                        onChange={(event) =>
                          update(row.key, { name: event.target.value })
                        }
                        aria-label="Service name"
                      />
                      <input
                        className="field"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={row.price}
                        placeholder="Price"
                        onChange={(event) =>
                          update(row.key, { price: event.target.value })
                        }
                        aria-label={`Price in ${currency}`}
                      />
                      <input
                        className="field"
                        type="number"
                        inputMode="numeric"
                        min={5}
                        max={1440}
                        step={5}
                        value={row.minutes}
                        placeholder={String(usualMinutes)}
                        onChange={(event) =>
                          // Changing the time is her checking it.
                          update(row.key, {
                            minutes: event.target.value,
                            review: null,
                            origin: null,
                          })
                        }
                        aria-label="Minutes (blank uses your usual length)"
                      />
                    </div>
                  </div>

                  {(row.priceNote || row.duplicate || row.origin || row.buffer > 0) && (
                    <p className="hint ml-8">
                      {row.duplicate && "Already on your list. "}
                      {row.priceNote && `Rate card says “${row.priceNote}”. `}
                      {row.origin && `${row.origin}. `}
                      {row.buffer > 0 &&
                        `${formatDuration(row.buffer)} kept free after it.`}
                    </p>
                  )}

                  {row.review && (
                    <p className="ml-8 mt-2 rounded-[10px] bg-notice px-3 py-2 text-[13px]">
                      <strong>Check this time:</strong> {row.review}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>

      {state.status === "error" && (
        <p className="mt-4 text-[14px] font-semibold text-accent" role="alert">
          {state.message}
        </p>
      )}

      <div className="mt-5">
        <ImportButton count={chosen.length} />
      </div>
    </form>
  );
}
