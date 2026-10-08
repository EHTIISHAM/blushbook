"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface DemoService {
  id: string;
  name: string;
  mins: number;
  price: number;
  swatch: string;
}

export interface DemoDay {
  wd: string;
  num: number;
  full: string;
}

const TIMES = [
  "10:00am",
  "11:30am",
  "1:00pm",
  "2:30pm",
  "4:00pm",
  "5:30pm",
] as const;

type Time = (typeof TIMES)[number];

interface Preset {
  id: string;
  tab: string;
  name: string;
  slug: string;
  initial: string;
  colour: string;
  services: DemoService[];
  /** What the demo books on its own. The time must be free on that day. */
  plan: { svc: string; day: number; time: Time };
}

/* Three kinds of business, so visitors see it isn't tied to one sector. */
const PRESETS: Preset[] = [
  {
    id: "clinic",
    tab: "Clinic",
    name: "Harbour Clinic",
    slug: "harbour-clinic",
    initial: "H",
    colour: "#C2255C",
    services: [
      { id: "initial", name: "Initial consultation", mins: 45, price: 60, swatch: "#C2255C" },
      { id: "follow-up", name: "Follow-up session", mins: 30, price: 40, swatch: "#FF9EC0" },
      { id: "massage", name: "Sports massage", mins: 60, price: 75, swatch: "#5B7FA6" },
    ],
    plan: { svc: "initial", day: 0, time: "11:30am" },
  },
  {
    id: "dental",
    tab: "Dental",
    name: "Bright Smile Dental",
    slug: "bright-smile",
    initial: "B",
    colour: "#2F6FB0",
    services: [
      { id: "check-up", name: "Check-up and clean", mins: 30, price: 85, swatch: "#2F6FB0" },
      { id: "whitening", name: "Teeth whitening", mins: 60, price: 250, swatch: "#7FB6E0" },
      { id: "emergency", name: "Emergency appointment", mins: 20, price: 95, swatch: "#C0504D" },
    ],
    plan: { svc: "whitening", day: 2, time: "5:30pm" },
  },
  {
    id: "salon",
    tab: "Salon",
    name: "Studio Nine Hair",
    slug: "studio-nine",
    initial: "S",
    colour: "#8E5A9E",
    services: [
      { id: "cut", name: "Cut and finish", mins: 45, price: 55, swatch: "#8E5A9E" },
      { id: "colour", name: "Colour and cut", mins: 120, price: 140, swatch: "#D08C60" },
      { id: "blow-dry", name: "Blow-dry", mins: 30, price: 35, swatch: "#7F9A86" },
    ],
    plan: { svc: "colour", day: 3, time: "1:00pm" },
  },
];

/** A fixed pattern, so the demo always has some slots already gone. */
const isTaken = (index: number, day: number) => (index + day) % 3 === 0;

interface DemoState {
  svc: string | null;
  day: number;
  time: string | null;
  booked: boolean;
}

const FRESH: DemoState = { svc: null, day: 0, time: null, booked: false };

/** How long the demo waits after a visitor's own tap before playing again. */
const IDLE_RESUME_MS = 12000;

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

class Cancelled extends Error {}

interface Tap {
  x: number;
  y: number;
  shown: boolean;
  pressed: boolean;
}

export function PhoneDemo({ days }: { days: DemoDay[] }) {
  const [presetIndex, setPresetIndex] = useState(0);
  const [state, setState] = useState<DemoState>(FRESH);
  const [notified, setNotified] = useState(false);
  const [tap, setTap] = useState<Tap>({ x: 50, y: 60, shown: false, pressed: false });
  const [playing, setPlaying] = useState(true);
  // Read by the running loop, so scrolling away pauses it rather than restarting it.
  const inView = useRef(false);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );

  const phoneRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preset = PRESETS[presetIndex];
  const service = preset.services.find((item) => item.id === state.svc) ?? null;
  const day = days[state.day];

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (resume.current) clearTimeout(resume.current);
    };
  }, []);

  useEffect(() => {
    const node = phoneRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting;
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chooseService = useCallback((id: string) => {
    setState((previous) => ({ ...previous, svc: id }));
  }, []);

  const chooseDay = useCallback((index: number) => {
    setState((previous) => {
      // A time that is already taken on the new day cannot stay selected.
      const keepTime =
        previous.time && !isTaken(TIMES.indexOf(previous.time as Time), index)
          ? previous.time
          : null;
      return { ...previous, day: index, time: keepTime };
    });
  }, []);

  const chooseTime = useCallback((time: string) => {
    setState((previous) => ({ ...previous, time }));
  }, []);

  const book = useCallback(() => {
    setState((previous) => ({ ...previous, booked: true }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotified(true), 700);
  }, []);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNotified(false);
    setState(FRESH);
    if (screenRef.current) screenRef.current.scrollTop = 0;
  }, []);

  /* The autoplay: tap through one booking per business, then move on. */
  useEffect(() => {
    if (!playing || reduced) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((done, fail) => {
        timers.push(
          setTimeout(() => (cancelled ? fail(new Cancelled()) : done()), ms),
        );
      });
    /** Waits, then holds while the phone is off screen. */
    const sleep = async (ms: number) => {
      await wait(ms);
      while (!inView.current) await wait(250);
    };

    /** Move the finger to an element, scroll it into the screen, press it. */
    async function tapOn(key: string, action: () => void) {
      const phone = phoneRef.current;
      const screen = screenRef.current;
      const target = phone?.querySelector<HTMLElement>(`[data-demo="${key}"]`);
      if (!phone || !screen || !target) return;

      const screenBox = screen.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      if (box.bottom > screenBox.bottom - 12) {
        screen.scrollTo({ top: screen.scrollTop + box.bottom - screenBox.bottom + 24, behavior: "smooth" });
        await sleep(450);
      }

      const phoneBox = phone.getBoundingClientRect();
      const now = target.getBoundingClientRect();
      setTap({
        x: ((now.left + now.width / 2 - phoneBox.left) / phoneBox.width) * 100,
        y: ((now.top + now.height / 2 - phoneBox.top) / phoneBox.height) * 100,
        shown: true,
        pressed: false,
      });
      await sleep(700);
      setTap((current) => ({ ...current, pressed: true }));
      action();
      await sleep(220);
      setTap((current) => ({ ...current, pressed: false }));
      await sleep(420);
    }

    async function run(start: number) {
      let index = start;
      for (;;) {
        const { plan } = PRESETS[index];
        setPresetIndex(index);
        reset();
        await sleep(1100);
        await tapOn(`svc-${plan.svc}`, () => chooseService(plan.svc));
        await tapOn(`day-${plan.day}`, () => chooseDay(plan.day));
        await tapOn(`time-${plan.time}`, () => chooseTime(plan.time));
        await tapOn("book", book);
        setTap((current) => ({ ...current, shown: false }));
        await sleep(3800);
        index = (index + 1) % PRESETS.length;
      }
    }

    run(presetIndex).catch((error) => {
      if (!(error instanceof Cancelled)) throw error;
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // presetIndex is read once as the starting point; the loop moves it on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduced, reset, chooseService, chooseDay, chooseTime, book]);

  /** A visitor's own tap pauses the demo, which picks up again when idle. */
  function takeOver(event: React.PointerEvent) {
    if (!event.isTrusted) return;
    setPlaying(false);
    setTap((current) => ({ ...current, shown: false }));
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(() => {
      setPresetIndex((current) => (current + 1) % PRESETS.length);
      setPlaying(true);
    }, IDLE_RESUME_MS);
  }

  function showPreset(index: number) {
    if (resume.current) clearTimeout(resume.current);
    setPlaying(false);
    setPresetIndex(index);
    reset();
    // Restart the loop from the chosen business on the next tick.
    setTimeout(() => setPlaying(true), 0);
  }

  const buttonLabel = !service
    ? "Choose a service"
    : !state.time
      ? "Pick a time"
      : "Book appointment";

  return (
    <>
      <div className="demo-tabs" role="tablist" aria-label="Example businesses">
        {PRESETS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === presetIndex}
            className="demo-tab"
            onClick={() => showPreset(index)}
          >
            {item.tab}
          </button>
        ))}
      </div>

      <div
        className="phone"
        ref={phoneRef}
        aria-label={`Demo of a BooknBloom booking page for ${preset.name}`}
        onPointerDown={takeOver}
      >
        <div className="notch" aria-hidden />

        <span
          aria-hidden
          className={`tap${tap.shown ? " show" : ""}${tap.pressed ? " pressed" : ""}`}
          style={{ left: `${tap.x}%`, top: `${tap.y}%` }}
        />

        <div
          className={`notif${notified ? " show" : ""}`}
          role="status"
          aria-live="polite"
        >
          {notified && service && day && (
            <>
              <span
                className="drop"
                style={{ "--swatch": service.swatch } as React.CSSProperties}
                aria-hidden
              />
              <span>
                <strong>New booking · {preset.name}</strong>
                <br />
                {service.name}, {day.full} at {state.time}.
              </span>
            </>
          )}
        </div>

        <div className="screen" ref={screenRef}>
          {state.booked && service && day ? (
            <div className="ok-screen">
              <div className="ok-mark" aria-hidden>
                ✓
              </div>
              <p className="ok-title">You&rsquo;re booked in</p>
              <p className="ok-sub">
                {service.name}
                <br />
                {day.full} at {state.time}
              </p>
              <p className="ok-next">Payment is made at {preset.name}.</p>
              <button className="p-btn ghost" type="button" onClick={reset}>
                Book again
              </button>
            </div>
          ) : (
            <>
              <div className="p-head">
                <span
                  className="p-av"
                  style={{ background: preset.colour }}
                  aria-hidden
                >
                  {preset.initial}
                </span>
                <div>
                  <p className="p-name">{preset.name}</p>
                  <p className="p-handle">booknbloom.app/{preset.slug}</p>
                </div>
              </div>

              <p className="p-label">Service</p>
              {preset.services.map((item) => (
                <button
                  key={item.id}
                  data-demo={`svc-${item.id}`}
                  className="p-svc"
                  type="button"
                  aria-pressed={state.svc === item.id}
                  onClick={() => chooseService(item.id)}
                >
                  <span
                    className="drop"
                    style={{ "--swatch": item.swatch } as React.CSSProperties}
                    aria-hidden
                  />
                  <span className="p-svc-name">
                    {item.name}
                    <small>{item.mins} min</small>
                  </span>
                  <span className="p-price">${item.price}</span>
                </button>
              ))}

              <p className="p-label">Day</p>
              <div className="p-days">
                {days.map((option, index) => (
                  <button
                    key={option.full}
                    data-demo={`day-${index}`}
                    className="p-day"
                    type="button"
                    aria-pressed={state.day === index}
                    onClick={() => chooseDay(index)}
                  >
                    {option.wd}
                    <b>{option.num}</b>
                  </button>
                ))}
              </div>

              <p className="p-label">Time</p>
              <div className="p-times">
                {TIMES.map((time, index) =>
                  isTaken(index, state.day) ? (
                    <button
                      key={time}
                      className="p-time"
                      type="button"
                      disabled
                      aria-label={`${time}, already booked`}
                    >
                      {time}
                    </button>
                  ) : (
                    <button
                      key={time}
                      data-demo={`time-${time}`}
                      className="p-time"
                      type="button"
                      aria-pressed={state.time === time}
                      onClick={() => chooseTime(time)}
                    >
                      {time}
                    </button>
                  ),
                )}
              </div>

              <button
                data-demo="book"
                className="p-btn"
                type="button"
                disabled={!service || !state.time}
                onClick={book}
              >
                {buttonLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="caption">
        Watch bookings come in, or tap the phone to try it yourself.
      </p>
    </>
  );
}
