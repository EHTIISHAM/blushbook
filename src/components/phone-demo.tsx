"use client";

import { useEffect, useRef, useState } from "react";

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

const SERVICES: DemoService[] = [
  {
    id: "initial",
    name: "Initial consultation",
    mins: 45,
    price: 60,
    swatch: "#0F766E",
  },
  {
    id: "follow-up",
    name: "Follow-up session",
    mins: 30,
    price: 40,
    swatch: "#E0A43B",
  },
  {
    id: "extended",
    name: "Extended appointment",
    mins: 60,
    price: 75,
    swatch: "#5B7FA6",
  },
];

const TIMES = [
  "10:00am",
  "11:30am",
  "1:00pm",
  "2:30pm",
  "4:00pm",
  "5:30pm",
] as const;

/** A fixed pattern, so the demo always has some slots already gone. */
const isTaken = (index: number, day: number) => (index + day) % 3 === 0;

interface DemoState {
  svc: string | null;
  day: number;
  time: string | null;
  booked: boolean;
}

const FRESH: DemoState = { svc: null, day: 0, time: null, booked: false };

export function PhoneDemo({ days }: { days: DemoDay[] }) {
  const [state, setState] = useState<DemoState>(FRESH);
  const [notified, setNotified] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Each step starts at the top of the screen, as the original demo did.
  useEffect(() => {
    if (screenRef.current) screenRef.current.scrollTop = 0;
  }, [state]);

  const service = SERVICES.find((item) => item.id === state.svc) ?? null;
  const day = days[state.day];

  function chooseService(id: string) {
    setState((previous) => ({ ...previous, svc: id }));
  }

  function chooseDay(index: number) {
    setState((previous) => {
      // A time that is already taken on the new day cannot stay selected.
      const keepTime =
        previous.time && !isTaken(TIMES.indexOf(previous.time as typeof TIMES[number]), index)
          ? previous.time
          : null;
      return { ...previous, day: index, time: keepTime };
    });
  }

  function chooseTime(time: string) {
    setState((previous) => ({ ...previous, time }));
  }

  function book() {
    setState((previous) => ({ ...previous, booked: true }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotified(true), 700);
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setNotified(false);
    setState(FRESH);
  }

  const buttonLabel = !service
    ? "Choose a service"
    : !state.time
      ? "Pick a time"
      : "Book appointment";

  return (
    <>
      <div className="phone" aria-label="Demo of a BooknBloom booking page">
        <div className="notch" aria-hidden />

        <div
          className={`notif${notified ? " show" : ""}`}
          role="status"
          aria-live="polite"
        >
          {notified && service && day && (
            <>
              <span className="drop" aria-hidden />
              <span>
                <strong>New booking</strong>
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
              <p className="ok-next">
                Payment is taken at your appointment.
              </p>
              <button className="p-btn ghost" type="button" onClick={reset}>
                Book again
              </button>
            </div>
          ) : (
            <>
              <div className="p-head">
                <span className="p-av" aria-hidden>
                  H
                </span>
                <div>
                  <p className="p-name">Harbour Clinic</p>
                  <p className="p-handle">booknbloom.app/harbour-clinic</p>
                </div>
              </div>

              <p className="p-label">Service</p>
              {SERVICES.map((item) => (
                <button
                  key={item.id}
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
                    <small>
                      {item.mins} min
                    </small>
                  </span>
                  <span className="p-price">${item.price}</span>
                </button>
              ))}

              <p className="p-label">Day</p>
              <div className="p-days">
                {days.map((option, index) => (
                  <button
                    key={option.full}
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
        Book as a client, then see what lands on your phone.
      </p>
    </>
  );
}
