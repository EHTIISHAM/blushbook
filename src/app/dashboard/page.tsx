import Link from "next/link";

import { getSessionProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

export default async function BookingsPage() {
  const { profile } = await getSessionProfile();

  if (!profile) {
    return (
      <div className="card max-w-[640px]">
        <h1 className="font-serif text-[32px] leading-none">
          Your studio isn&rsquo;t set up yet
        </h1>
        <p className="mt-3 text-[15px] text-muted">
          You&rsquo;re logged in, but there&rsquo;s no profile row for this
          account. That happens when the database migration in{" "}
          <code className="rounded bg-bubble px-1.5 py-0.5 text-[13px]">
            supabase/migrations
          </code>{" "}
          hasn&rsquo;t been applied yet, so the signup trigger never ran. Apply
          it, then log out and back in.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  const [services, availability] = await Promise.all([
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("is_active", true),
    supabase
      .from("availability")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id),
  ]);

  const checklist: ChecklistItem[] = [
    {
      label: "Name your studio and claim your link",
      done: profile.business_name.trim().length > 0,
      href: "/dashboard/profile",
      cta: "Profile",
    },
    {
      label: "Add at least one service",
      done: (services.count ?? 0) > 0,
      href: "/dashboard/services",
      cta: "Services",
    },
    {
      label: "Set the days and times you work",
      done: (availability.count ?? 0) > 0,
      href: "/dashboard/hours",
      cta: "Hours",
    },
    {
      label: "Add your deposit link",
      done: Boolean(profile.deposit_link),
      href: "/dashboard/profile",
      cta: "Profile",
    },
    {
      label: "Write your no-show policy",
      done: Boolean(profile.no_show_policy),
      href: "/dashboard/profile",
      cta: "Profile",
    },
  ];

  const remaining = checklist.filter((item) => !item.done).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section aria-labelledby="bookings-h">
        <h1 id="bookings-h" className="font-serif text-[40px] leading-none">
          Bookings
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Every booking made through your link lands here.
        </p>

        <div className="mt-6 rounded-[26px] bg-mauve px-6 py-10 text-center">
          <p className="font-serif text-[26px] leading-tight">
            No bookings yet
          </p>
          <p className="mx-auto mt-2 max-w-[38ch] text-[15px] text-muted">
            The booking page and this list are next up in the build. Finish the
            checklist so everything is ready when they switch on.
          </p>
        </div>
      </section>

      <section aria-labelledby="setup-h" className="card lg:sticky lg:top-6">
        <h2 id="setup-h" className="font-serif text-[28px] leading-none">
          Get set up
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          {remaining === 0
            ? "All done. Your page has everything it needs."
            : `${remaining} thing${remaining === 1 ? "" : "s"} left.`}
        </p>

        <ul className="mt-5 grid gap-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <span
                aria-hidden
                className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-bold ${
                  item.done
                    ? "bg-cherry text-cherry-ink"
                    : "bg-bubble text-muted"
                }`}
              >
                {item.done ? "✓" : ""}
              </span>

              <span className="min-w-0 flex-1 text-[15px]">
                <span className={item.done ? "text-muted line-through" : ""}>
                  {item.label}
                </span>
                {!item.done && (
                  <Link
                    href={item.href}
                    className="ml-2 whitespace-nowrap text-[14px] font-semibold text-cherry underline underline-offset-4"
                  >
                    {item.cta}
                  </Link>
                )}
                <span className="sr-only">
                  {item.done ? " — done" : " — not done yet"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
