import Link from "next/link";

import { BrandLock, BrandMark } from "@/components/brand";
import {
  AnalyticsScene,
  FollowUpScene,
  LinkScene,
  RateCardScene,
} from "@/components/feature-scenes";
import { PhoneDemo, type DemoDay } from "@/components/phone-demo";
import { formatMoney } from "@/lib/format";
import { ANNUAL_SAVING_CENTS, GRACE_DAYS, PLANS } from "@/lib/plans";

import "./landing.css";

// The demos show the coming days and recent weeks, so regenerate the page
// hourly rather than freezing the dates at build time.
export const revalidate = 3600;

/** Dates are built here so the server and the client render the same ones. */
function nextFourDays(): DemoDay[] {
  const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("en-US", options);

  return [1, 2, 3, 4].map((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);

    return {
      wd: format(date, { weekday: "short" }),
      num: date.getDate(),
      full: format(date, { weekday: "short", month: "short", day: "numeric" }),
    };
  });
}

const SECTORS = [
  "Clinics",
  "Dentists",
  "Salons",
  "Tutors",
  "Coaches",
  "Consultants",
  "Pet services",
  "Local services",
];

const FEATURES = [
  {
    id: "rate-card",
    Scene: RateCardScene,
    eyebrow: "Setup shortcut",
    title: "Upload your rate card. Skip the typing.",
    body: "Upload a photo or screenshot of your rate card and BooknBloom helps fill in your services.",
    points: [
      "Prices and durations read for you",
      "Check everything before it's added",
      "Live in minutes, not an afternoon",
    ],
  },
  {
    id: "one-link",
    Scene: LinkScene,
    eyebrow: "One booking link",
    title: "Stop the back-and-forth",
    body: "Answer every “are you free?” with the same link. Clients see only open times, pick one and book.",
    points: [
      "Share by WhatsApp, email, your website or social profiles",
      "No double bookings, ever",
      "Every booking lands in your dashboard",
    ],
  },
  {
    id: "analytics",
    Scene: AnalyticsScene,
    eyebrow: "Analytics",
    title: "See what's working, not just charts",
    body: "See bookings, revenue, quiet times, no-shows and clients due to rebook from one simple dashboard.",
    points: [
      "Revenue, bookings and trends at a glance",
      "Busy and quiet times, popular services",
      "New and returning clients",
    ],
  },
  {
    id: "follow-ups",
    Scene: FollowUpScene,
    eyebrow: "Follow-ups",
    title: "Win back missed appointments in one tap",
    body: "When a client doesn't show, or a regular is overdue, your dashboard tells you. One tap opens WhatsApp with a polite message already written.",
    points: [
      "No-shows flagged automatically",
      "Spots regulars who are overdue",
      "You can edit the message before sending",
    ],
  },
] as const;

const INCLUDES = [
  "Your own booking page and shareable link",
  "Unlimited bookings and services",
  "Prices and durations for every service",
  "Rate card upload from a photo or screenshot",
  "Working hours and time off",
  "Your no-show and cancellation policy, shown before booking",
  "Ready-made messages for sharing your link",
  "One-tap WhatsApp follow-ups for no-shows and clients due back",
  "Revenue, bookings and booking trends",
  "Popular services, busy and quiet times",
  "No-show, cancellation and returning client tracking",
  "Currency and timezone settings",
  "Works on any phone",
];

export default function HomePage() {
  const days = nextFourDays();
  const monthly = PLANS.monthly;
  const annual = PLANS.annual;

  return (
    <div className="landing">
      <header className="masthead wrap" id="top">
        <BrandLock href="#top" />
        <nav className="flex items-center gap-2">
          <Link className="btn ghost sm hidden whitespace-nowrap min-[420px]:inline-flex" href="/login">
            Log in
          </Link>
          <Link className="btn sm whitespace-nowrap" href="/login">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero wrap">
          <div>
            <h1>
              One booking link.
              <br />
              Clearer business insights.
            </h1>
            <p className="lede">
              Clients book your services and choose a time. You track revenue,
              no-shows, busy hours and repeat customers.
            </p>
            <div className="cta-row">
              <Link className="btn" href="/login">
                Get started
              </Link>
              <a className="btn ghost" href="#features">
                See how it works
              </a>
            </div>
            <p className="fine">
              Set up in minutes. No commission and no booking fees.
            </p>
          </div>

          <div>
            <PhoneDemo days={days} />
          </div>
        </section>

        <section className="band wrap" aria-labelledby="who-h">
          <h2 id="who-h">Built for businesses that run on appointments</h2>
          <ul className="sectors">
            {SECTORS.map((sector) => (
              <li key={sector}>{sector}</li>
            ))}
          </ul>
        </section>

        <section className="band wrap" id="how" aria-labelledby="how-h">
          <h2 id="how-h">Live in minutes, then your link does the booking</h2>
          <ol className="steps">
            <li>
              <h3>Add your services</h3>
              <p>
                Photograph your rate card and the services fill in, or type
                them yourself.
              </p>
            </li>
            <li>
              <h3>Set your hours and share</h3>
              <p>
                Pick the days you work, then send your link by WhatsApp, email,
                your website or social profiles.
              </p>
            </li>
            <li>
              <h3>Clients book, you see the numbers</h3>
              <p>
                Only open times show, so double bookings can&rsquo;t happen.
                Every booking feeds your dashboard.
              </p>
            </li>
          </ol>
        </section>

        <section className="band wrap" id="features" aria-labelledby="features-h">
          <h2 id="features-h" className="features-h">
            Everything you need to take bookings and grow, in one place
          </h2>

          {FEATURES.map((feature, index) => {
            const side = index % 2 === 0 ? "left" : "right";
            return (
              <div
                key={feature.id}
                id={feature.id}
                className={`feature feature-${side}`}
              >
                <feature.Scene side={side} />
                <div className="feature-copy">
                  <p className="eyebrow mb-3">{feature.eyebrow}</p>
                  <h3>{feature.title}</h3>
                  <p className="lede">{feature.body}</p>
                  <ul className="ticks">
                    {feature.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </section>

        <section className="pricing wrap" id="pricing" aria-labelledby="price-h">
          <div className="text-center">
            <h2 id="price-h" className="mx-auto">
              One plan. Everything included.
            </h2>
            <p className="lede mx-auto">
              No commission. No booking fees. Clients pay you directly.
            </p>
          </div>

          <div className="plans">
            {[monthly, annual].map((plan) => (
              <div
                key={plan.key}
                className={`plan-card${plan.key === "annual" ? " best" : ""}`}
              >
                <p className="plan-name">
                  {plan.label}
                  {plan.key === "annual" && <span className="badge">Best value</span>}
                </p>
                <p className="price">
                  <span className="sr">Regular price</span>
                  <s>{formatMoney(plan.regularCents, "USD")}</s>
                  <span className="sr">Launch price</span>
                  <span className="now">{formatMoney(plan.priceCents, "USD")}</span>
                  <span className="per">/{plan.per}</span>
                </p>
                <p className="launch">
                  {plan.key === "annual"
                    ? `Save ${formatMoney(ANNUAL_SAVING_CENTS, "USD")} against paying monthly, about a month and a half free.`
                    : "Flexible. Cancel anytime."}
                </p>
              </div>
            ))}
          </div>

          <div className="includes-box">
            <h3>Everything in the plan</h3>
            <ul className="includes">
              {INCLUDES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-8 text-center">
            <Link className="btn" href="/login">
              Get started
            </Link>
            <p className="plan-note">
              Launch prices stay locked in for as long as you stay subscribed.
            </p>
          </div>
        </section>

        <section className="faq wrap narrow" aria-labelledby="faq-h">
          <h2 id="faq-h">Questions</h2>

          <details>
            <summary>When do I start paying?</summary>
            <p>
              Setting up your page and sharing your link costs nothing. Once
              bookings start coming in, you have {GRACE_DAYS} days to choose
              monthly or annual and keep your dashboard open.
            </p>
          </details>

          <details>
            <summary>Do you take a cut of my bookings?</summary>
            <p>
              No. Clients pay you directly, the way they do now. BooknBloom is
              one flat subscription with no commission and no booking fees.
            </p>
          </details>

          <details>
            <summary>Is it only for one kind of business?</summary>
            <p>
              No. If clients book time with you, it fits: clinics, dentists,
              salons, tutors, coaches, consultants and more.
            </p>
          </details>

          <details>
            <summary>Do my clients need to download anything?</summary>
            <p>No. They tap your link and book in their browser, on any phone.</p>
          </details>

          <details>
            <summary>Will my price go up?</summary>
            <p>
              Not while you stay subscribed. Your launch price stays the same
              even after the regular price applies to new subscribers.
            </p>
          </details>

          <details>
            <summary>Can I cancel?</summary>
            <p>Yes, anytime. There&rsquo;s no contract.</p>
          </details>
        </section>
      </main>

      <footer className="foot wrap">
        <span className="foot-brand">
          <BrandMark />© 2026 BooknBloom
        </span>
        <span>Booking and analytics for appointment-based businesses</span>
      </footer>
    </div>
  );
}
