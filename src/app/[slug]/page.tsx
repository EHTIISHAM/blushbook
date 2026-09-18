import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandMark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

import { BookingFlow, type PublicService } from "./booking-flow";

/** Columns anonymous visitors are granted. Never `select *` here: the grant
 *  is column-level, so asking for everything is refused outright. */
const PUBLIC_PROFILE_COLUMNS =
  "id, slug, business_name, instagram_handle, bio, photo_path, timezone, currency, no_show_policy";

async function loadPage(slug: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  return { supabase, profile };
}

export async function generateMetadata({
  params,
}: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { profile } = await loadPage(slug);

  // Covers both a typo'd link and a paused page; neither should advertise a
  // studio name in the tab.
  if (!profile) return { title: "Page not found" };

  return {
    title: `Book with ${profile.business_name}`,
    description:
      profile.bio ?? `Pick a service and a time with ${profile.business_name}.`,
    robots: { index: false },
  };
}

function photoUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/profile-photos/${path}`;
}

export default async function BookingPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const { supabase, profile } = await loadPage(slug);

  if (!profile) {
    // The public policy hides paused pages entirely, so ask what actually
    // happened rather than telling someone with a valid link it is a 404.
    const { data: status } = await supabase.rpc("page_status", {
      p_slug: slug,
    });

    if (status !== "paused") {
      notFound();
    }

    return (
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 py-16 text-center">
        <BrandMark className="mx-auto h-14 w-12" />
        <h1 className="mt-6 font-display text-[27px] leading-none">
          Bookings are paused
        </h1>
        <p className="mt-4 text-[16px] text-muted">
          This page isn&rsquo;t taking bookings at the moment. Message her
          directly and she&rsquo;ll sort you out.
        </p>
      </main>
    );
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, deposit_cents, swatch")
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const list: PublicService[] = services ?? [];
  const photo = photoUrl(profile.photo_path);
  const initial = profile.business_name.trim().charAt(0).toUpperCase() || "B";

  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-5 py-10">
      <header className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] flex-none rounded-full object-cover"
          />
        ) : (
          <span
            className="grid h-[72px] w-[72px] flex-none place-items-center rounded-full bg-cherry font-display text-[20px] text-cherry-ink"
            aria-hidden
          >
            {initial}
          </span>
        )}

        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-none">
            {profile.business_name}
          </h1>
          {profile.instagram_handle && (
            <a
              href={`https://instagram.com/${profile.instagram_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-muted"
            >
              @{profile.instagram_handle}
            </a>
          )}
        </div>
      </header>

      {profile.bio && (
        <p className="mt-4 text-[15px] text-muted">{profile.bio}</p>
      )}

      {list.length === 0 ? (
        <p className="mt-8 rounded-[14px] bg-bubble px-4 py-3 text-[15px]">
          No services are listed yet. Check back soon.
        </p>
      ) : (
        <BookingFlow
          slug={profile.slug}
          timezone={profile.timezone}
          currency={profile.currency}
          noShowPolicy={profile.no_show_policy}
          services={list}
        />
      )}

      <footer className="mt-12 border-t border-line pt-5 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] text-muted no-underline"
        >
          <BrandMark className="h-4 w-3.5" />
          Booked with Blushbook
        </Link>
      </footer>
    </main>
  );
}
