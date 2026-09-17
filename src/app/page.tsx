import Link from "next/link";

import { BrandMark } from "@/components/brand";
import { PhoneDemo, type DemoDay } from "@/components/phone-demo";

import "./landing.css";

// The demo shows the next four days, so regenerate the page hourly rather
// than freezing the dates at build time.
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

export default function HomePage() {
  const days = nextFourDays();

  return (
    <div className="landing">
      <header className="masthead wrap" id="top">
        <Link href="#top" className="brand flex items-center gap-[10px] no-underline" aria-label="Blushbook home">
          <BrandMark className="h-9 w-8 flex-none" />
          <span className="font-serif text-[25px] leading-none tracking-[0.12em]">
            BLUSHBOOK
          </span>
        </Link>
        <Link className="btn sm" href="/login">
          Start free
        </Link>
      </header>

      <main>
        <section className="hero wrap">
          <div>
            <h1>
              Fully booked,
              <br />
              zero DMs.
            </h1>
            <p className="lede">
              One link for your Instagram bio. Clients pick a service, choose a
              time and pay your deposit, so you can stop answering &ldquo;what
              times do you have?&rdquo; at midnight.
            </p>
            <div className="cta-row">
              <Link className="btn" href="/login">
                Start free
              </Link>
              <a className="btn ghost" href="#how">
                How it works
              </a>
            </div>
            <p className="fine">
              Made for lash, nail and brow techs. Free until your first booking
              comes in.
            </p>
          </div>

          <div>
            <PhoneDemo days={days} />
          </div>
        </section>

        <section className="band wrap" aria-labelledby="dm-h">
          <h2 id="dm-h">DM bookings eat your evenings</h2>
          <div className="dm-grid">
            <figure className="thread">
              <figcaption>Your DMs now</figcaption>
              <p className="bub in">hiii are you free thursday?</p>
              <p className="bub out">I have 11am or 2:30!</p>
              <p className="bub in">how much is hybrid again</p>
              <p className="bub out">$75, and a $20 deposit holds it</p>
              <p className="bub in">can u do 4 instead 🥺</p>
              <p className="bub out">4 is taken, is 5:30 ok?</p>
              <p className="seen">Seen 11:52pm</p>
            </figure>

            <figure className="thread better">
              <figcaption>Your DMs with Blushbook</figcaption>
              <p className="bub in">hiii are you free thursday?</p>
              <p className="bub out">
                Hey babe, all my open times are here 💕
                blushbook.app/lashesbyhira
              </p>
              <p className="bub sys">
                New booking: Hybrid full set, Thursday at 2:30pm
              </p>
            </figure>
          </div>
        </section>

        <section className="band wrap" id="how" aria-labelledby="how-h">
          <h2 id="how-h">Set up once, then your link does the booking</h2>
          <ol className="steps">
            <li>
              <h3>Add your services and hours</h3>
              <p>
                Prices, deposit amounts and the days you work. Done in a few
                minutes from your phone.
              </p>
            </li>
            <li>
              <h3>Put your link in your bio</h3>
              <p>
                Instagram, TikTok, WhatsApp, wherever clients find you. Answer
                every &ldquo;are you free?&rdquo; with the same link.
              </p>
            </li>
            <li>
              <h3>Clients book and pay the deposit</h3>
              <p>
                Only open slots show, so double bookings can&rsquo;t happen.
                Deposits go straight to your own PayPal or Stripe.
              </p>
            </li>
          </ol>
        </section>

        <section className="pricing wrap" id="pricing" aria-labelledby="price-h">
          <div className="plan">
            <div>
              <h2 id="price-h">One plan, everything in it</h2>
              <p className="price">
                <span className="sr">Regular price</span>
                <s>$47.99</s>
                <span className="sr">Launch price</span>
                <span className="now">$19.99</span>
                <span className="per">/month</span>
              </p>
              <p className="launch">
                Launch price, locked in for as long as you stay subscribed. The
                regular price is $47.99 a month.
              </p>
            </div>

            <ul className="includes">
              <li>Your own booking link and page</li>
              <li>Unlimited bookings and services</li>
              <li>Deposits paid straight to you, no cut taken</li>
              <li>WhatsApp reminders in one tap</li>
              <li>Your no-show policy shown before clients book</li>
              <li>A ready-made reply for booking DMs</li>
            </ul>

            <Link className="btn" href="/login">
              Lock in $19.99/month
            </Link>
            <p className="plan-note">
              Set up free. You only start paying when your first client books
              through your link. Cancel anytime.
            </p>
          </div>
        </section>

        <section className="faq wrap narrow" aria-labelledby="faq-h">
          <h2 id="faq-h">Questions</h2>

          <details>
            <summary>When do I start paying?</summary>
            <p>
              Once your first client books through your link. Setting up your
              page and sharing it costs nothing.
            </p>
          </details>

          <details>
            <summary>Do you take a cut of my deposits?</summary>
            <p>
              No. Clients pay through your own PayPal or Stripe link, so the
              money goes straight to you. Blushbook is one flat monthly price.
            </p>
          </details>

          <details>
            <summary>Do my clients need to download anything?</summary>
            <p>No. They tap your link and book in their browser, on any phone.</p>
          </details>

          <details>
            <summary>Will my $19.99 price go up?</summary>
            <p>
              Not while you stay subscribed. Your launch price stays the same
              even after new studios move to $47.99.
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
          <BrandMark />© 2026 Blushbook
        </span>
        <span>Made for solo beauty pros</span>
      </footer>
    </div>
  );
}
