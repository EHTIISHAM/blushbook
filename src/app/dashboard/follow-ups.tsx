"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export interface FollowUpItem {
  id: string;
  kind: "no_show" | "overdue";
  title: string;
  detail: string;
  message: string;
  href: string;
}

const DISMISSED_KEY = "bnb:dismissed-follow-ups";
const SHOWN_KEY = "bnb:follow-up-popup-shown";

/* Dismissals live in this browser only. Storage can be blocked, in which case
   everything simply shows. */
function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: string[] = [];

function snapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DISMISSED_KEY);
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = readDismissed();
  }
  return cached;
}

const EMPTY: string[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss(id: string) {
  try {
    // Keep the list bounded; old ids belong to events long gone.
    const next = [...readDismissed().filter((v) => v !== id), id].slice(-300);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((listener) => listener());
}

function FollowUpList({ items }: { items: FollowUpItem[] }) {
  return (
    <ul className="mt-4 grid gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-[18px] bg-paper p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
            {item.kind === "no_show" ? "Missed appointment" : "Due back"}
          </p>
          <p className="mt-1 text-[15px] font-bold">{item.title}</p>
          <p className="text-[14px] text-muted">{item.detail}</p>
          <p className="mt-2 rounded-[12px] bg-bubble px-3 py-2 text-[14px] whitespace-pre-line">
            {item.message}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="btn btn-sm"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => dismiss(item.id)}
            >
              Message on WhatsApp
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => dismiss(item.id)}
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Clients worth a message, as a card on the Bookings tab. The first time the
 * dashboard opens in a browser session with something new, it also pops up.
 */
export function FollowUps({ items }: { items: FollowUpItem[] }) {
  const dismissed = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const open = items.filter((item) => !dismissed.includes(item.id));
  const dialog = useRef<HTMLDialogElement>(null);
  const popped = useRef(false);

  useEffect(() => {
    if (popped.current || open.length === 0) return;
    popped.current = true;
    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return;
      sessionStorage.setItem(SHOWN_KEY, "1");
    } catch {}
    dialog.current?.showModal();
  }, [open.length]);

  if (open.length === 0) return null;

  const heading = `${open.length} client${open.length === 1 ? "" : "s"} to follow up`;

  return (
    <>
      <section aria-labelledby="follow-h" className="mb-8 rounded-[26px] bg-tint p-5">
        <h2 id="follow-h" className="font-display text-[19px] leading-none">
          {heading}
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          One tap opens WhatsApp with the message ready. You can change it
          there before sending.
        </p>
        <FollowUpList items={open} />
      </section>

      <dialog
        ref={dialog}
        aria-labelledby="follow-dialog-h"
        className="m-auto w-[min(92vw,520px)] rounded-[26px] bg-tint p-5 text-ink backdrop:bg-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="follow-dialog-h" className="font-display text-[19px] leading-none">
            {heading}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <FollowUpList items={open.slice(0, 5)} />
        </div>
        {open.length > 5 && (
          <p className="hint">And {open.length - 5} more on your Bookings tab.</p>
        )}
      </dialog>
    </>
  );
}
