"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/* ---------------------------------------------------------------------------
   Short looping product scenes for the landing page, in the spirit of an
   animated screenshot: a cropped, simplified BooknBloom screen acts out one
   thing. Built from markup rather than video so they stay sharp, follow the
   theme and weigh almost nothing.

   Each scene is a list of step durations. Elements switch on with `at(n)`
   once the scene reaches step n, and CSS transitions do the movement. Scenes
   only run while on screen, and anyone who prefers reduced motion sees the
   finished frame, still.
   --------------------------------------------------------------------------- */

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useSceneStep(durations: number[]) {
  const ref = useRef<HTMLDivElement>(null);
  const last = durations.length - 1;
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  // The server renders the moving version; the finished frame takes over on
  // the client for anyone who prefers reduced motion.
  const still = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );

  useEffect(() => {
    if (still) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setRunning(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [still]);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(
      () => setStep((current) => (current >= last ? 0 : current + 1)),
      durations[step],
    );
    return () => clearTimeout(timer);
  }, [running, step, durations, last]);

  const current = still ? last : step;
  return { ref, at: (n: number) => current >= n };
}

/** "is-on" once the scene reaches step n. */
function on(active: boolean, base = "") {
  return `${base}${active ? " is-on" : ""}`;
}

function Cursor({ x, y, pressed }: { x: number; y: number; pressed?: boolean }) {
  return (
    <svg
      className={`sc-cursor${pressed ? " is-pressed" : ""}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        d="M5 3l14 8-6.2 1.6L10 19z"
        fill="#1C1424"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Frame({
  label,
  side,
  children,
  sceneRef,
}: {
  label: string;
  side: "left" | "right";
  children: React.ReactNode;
  sceneRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={sceneRef}
      className={`sc-frame sc-${side}`}
      role="img"
      aria-label={label}
    >
      <div className="sc-window" aria-hidden>
        {children}
      </div>
    </div>
  );
}

/* 1. Rate card → services ------------------------------------------------- */

const SCANNED = [
  ["Initial consultation", "45 min", "$60"],
  ["Follow-up session", "30 min", "$40"],
  ["Extended appointment", "60 min", "$75"],
] as const;

const RATE_CARD_STEPS = [900, 900, 1400, 450, 450, 700, 700, 600, 2600];

export function RateCardScene({ side }: { side: "left" | "right" }) {
  const { ref, at } = useSceneStep(RATE_CARD_STEPS);

  return (
    <Frame
      sceneRef={ref}
      side={side}
      label="A photo of a rate card is uploaded and three services fill in automatically"
    >
      <div className="sc-bar">
        <span className="sc-title">Services</span>
        <span className={on(at(1) && !at(3), "sc-chip")}>Reading your rate card…</span>
      </div>

      <div className="sc-body sc-rate">
        <figure className={on(at(1), "sc-photo")}>
          <p className="sc-photo-title">Price list</p>
          {SCANNED.map(([name, , price]) => (
            <p key={name}>
              <span>{name}</span>
              <span>{price}</span>
            </p>
          ))}
          <span className={on(at(2) && !at(3), "sc-sweep")} />
        </figure>

        <div className="sc-list">
          {!at(3) && <p className="sc-empty">No services yet</p>}
          {SCANNED.map(([name, mins, price], index) => (
            <div key={name} className={on(at(3 + index), "sc-row")}>
              <span className="sc-tick">✓</span>
              <span className="sc-grow">
                <strong>{name}</strong>
                <small>{mins}</small>
              </span>
              <span>{price}</span>
            </div>
          ))}
          <span className={on(at(6), "sc-btn sc-btn-block") + (at(7) ? " is-pressed" : "")}>
            Import 3 services
          </span>
        </div>

        <p className={on(at(8), "sc-toast")}>3 services added</p>
      </div>

      <Cursor x={at(6) ? 78 : 92} y={at(6) ? 82 : 96} pressed={at(7) && !at(8)} />
    </Frame>
  );
}

/* 2. One link → a booking -------------------------------------------------- */

const LINK_STEPS = [700, 1000, 1100, 1300, 1000, 2800];

export function LinkScene({ side }: { side: "left" | "right" }) {
  const { ref, at } = useSceneStep(LINK_STEPS);

  return (
    <Frame
      sceneRef={ref}
      side={side}
      label="A client asks for a time, gets the booking link, and a new booking arrives"
    >
      <div className="sc-bar">
        <span className="sc-avatar">J</span>
        <span className="sc-title">Jordan Reid</span>
      </div>

      <div className="sc-body sc-chat">
        <p className={on(at(1), "sc-bub sc-in")}>
          Hi, do you have anything Thursday afternoon?
        </p>
        <p className={on(at(2) && !at(3), "sc-typing")}>
          <span />
          <span />
          <span />
        </p>
        <div className={on(at(3), "sc-bub sc-out")}>
          Thanks for getting in touch! Pick any open time here:
          <span className="sc-link">
            <b>Harbour Clinic</b>
            booknbloom.app/harbour-clinic
          </span>
        </div>

        <div className={on(at(4), "sc-notif")}>
          <span className="sc-dot" />
          <span>
            <strong>New booking</strong>
            <br />
            Jordan Reid · Follow-up session, Thu 2:30pm
          </span>
        </div>
      </div>
    </Frame>
  );
}

/* 3. Analytics ------------------------------------------------------------- */

const STATS = [
  { label: "Revenue", value: 4860, format: (n: number) => `$${n.toLocaleString("en-US")}` },
  { label: "Bookings", value: 96, format: (n: number) => String(n) },
  { label: "No-show rate", value: 4, format: (n: number) => `${n}%` },
  { label: "Returning", value: 58, format: (n: number) => `${n}%` },
];

function CountUp({ to, active, format }: { to: number; active: boolean; format: (n: number) => string }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      const reset = requestAnimationFrame(() => setValue(0));
      return () => cancelAnimationFrame(reset);
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // A frame's timestamp can fall just before `start`, so clamp at 0 too.
      const t = Math.min(1, Math.max(0, (now - start) / 900));
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Background tabs throttle animation frames; land on the number anyway.
    const settle = setTimeout(() => setValue(to), 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [active, to]);

  return <>{format(value)}</>;
}

const ANALYTICS_STEPS = [600, 1200, 1400, 900, 900, 2600];

export function AnalyticsScene({ side }: { side: "left" | "right" }) {
  const { ref, at } = useSceneStep(ANALYTICS_STEPS);

  return (
    <Frame
      sceneRef={ref}
      side={side}
      label="Revenue, bookings, no-show rate and returning clients fill in, the trend rises, and a tip appears"
    >
      <div className="sc-bar">
        <span className="sc-title">Analytics</span>
        <span className="sc-seg">
          <span className="is-active">30 days</span>
          <span>90 days</span>
        </span>
      </div>

      <div className="sc-body">
        <div className="sc-stats">
          {STATS.map((stat, index) => (
            <div key={stat.label} className={index > 1 ? "sc-stat sc-warm" : "sc-stat"}>
              <b>
                <CountUp to={stat.value} active={at(1)} format={stat.format} />
              </b>
              <small>{stat.label}</small>
            </div>
          ))}
        </div>

        <svg className="sc-chart" viewBox="0 0 300 90" preserveAspectRatio="none">
          <path
            className={on(at(2), "sc-area")}
            d="M0 70 L27 62 L54 66 L82 54 L109 57 L136 44 L164 47 L191 36 L218 39 L245 28 L273 31 L300 18 L300 90 L0 90 Z"
          />
          <path
            className={on(at(2), "sc-line")}
            pathLength={1}
            d="M0 70 L27 62 L54 66 L82 54 L109 57 L136 44 L164 47 L191 36 L218 39 L245 28 L273 31 L300 18"
          />
        </svg>

        <div className={on(at(3), "sc-insight") + (at(4) ? " is-hover" : "")}>
          <strong>Worth acting on</strong>
          Quiet on Tue 2pm–3pm. A good time to offer a slot.
        </div>
      </div>

      <Cursor x={at(4) ? 60 : 88} y={at(4) ? 86 : 98} />
    </Frame>
  );
}

/* 4. No-show → WhatsApp ---------------------------------------------------- */

const FOLLOW_STEPS = [700, 1000, 900, 500, 1100, 900, 2600];

export function FollowUpScene({ side }: { side: "left" | "right" }) {
  const { ref, at } = useSceneStep(FOLLOW_STEPS);
  const inChat = at(4);

  return (
    <Frame
      sceneRef={ref}
      side={side}
      label="A missed appointment appears on the dashboard and one tap sends a WhatsApp message"
    >
      <div className="sc-bar">
        {inChat ? (
          <>
            <span className="sc-avatar sc-wa">S</span>
            <span className="sc-title">Sam Patel</span>
          </>
        ) : (
          <span className="sc-title">Bookings</span>
        )}
      </div>

      {!inChat ? (
        <div className="sc-body">
          <div className={on(at(1), "sc-card")}>
            <small className="sc-kicker">Missed appointment</small>
            <strong>Sam Patel</strong>
            <span className="sc-muted">Follow-up session, Thursday 10:00am</span>
            <p className="sc-quote">
              Hi Sam, we missed you today. Would you like to pick a new time?
            </p>
            <span className={"sc-btn sc-wa-btn" + (at(3) ? " is-pressed" : "")}>
              Message on WhatsApp
            </span>
          </div>
        </div>
      ) : (
        <div className="sc-body sc-chat sc-wa-bg">
          <div className={on(at(5), "sc-bub sc-out sc-wa-out")}>
            Hi Sam, we missed you at your appointment today. Would you like to
            pick a new time? booknbloom.app/harbour-clinic
            <span className="sc-ticks">✓✓</span>
          </div>
          <p className={on(at(6), "sc-bub sc-in")}>Sorry! Booking Monday now 🙏</p>
        </div>
      )}

      {!inChat && <Cursor x={at(2) ? 40 : 86} y={at(2) ? 80 : 98} pressed={at(3)} />}
    </Frame>
  );
}
