# Blushbook

One booking link for solo lash, nail and brow techs. Clients pick a service and
a time on the tech's page, then get sent to her own deposit link; she runs
everything from a dashboard.

## Stack

| Piece     | Choice                                          |
| --------- | ----------------------------------------------- |
| App       | Next.js 16 (App Router, TypeScript, Tailwind v4) |
| Backend   | Supabase (Postgres, magic-link auth, RLS, storage) |
| Billing   | Paddle as merchant of record (not wired yet)    |
| Hosting   | Coolify on a VPS, or Vercel                     |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

The marketing page runs without any environment variables. The dashboard needs
Supabase, and says so plainly if it is missing.

### Setting up Supabase

1. Create a project, then copy the URL and anon key from **Project Settings →
   API** into `.env.local`.
2. Apply `supabase/migrations/20260917120000_init.sql` — either with
   `npx supabase db push`, or by pasting it into the SQL editor.
3. Under **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` to the redirect allow-list (plus your
   production URL when you deploy).

The migration creates the tables, the row-level security policies, the signup
trigger that gives every new account a profile, and the `profile-photos`
storage bucket.

### Regenerating database types

`src/lib/supabase/database.types.ts` is hand-written to match the migration.
Once a project exists, replace it with the generated version:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
```

## How the data model protects a booking

Double bookings are blocked by Postgres itself, not by application code:

```sql
constraint bookings_no_overlap exclude using gist (
  profile_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('booked', 'completed'))
```

Two clients cannot hold the same slot even if they submit at the same instant.
Cancelled and no-show bookings drop out of the constraint, which frees the slot
again.

## Layout

```
src/app/                 routes
  page.tsx               marketing page
  login/                 magic-link form
  auth/                  callback + sign out
  dashboard/             bookings, services, hours, profile, share, billing
src/components/          brand mark, phone demo
src/lib/                 formatting, slug rules, Supabase clients
src/proxy.ts             session refresh + dashboard guard
supabase/migrations/     schema, RLS, functions
reference/               the original static index.html and demo.html
```

## Build order

1. ~~Login, profiles, services and hours~~ — done
2. Public booking page and booking creation, with rate limiting
3. Dashboard bookings list, actions and WhatsApp reminders
4. Paddle checkout, webhooks and pausing unpaid pages
5. Legal pages, domain, analytics, launch
