# Deploying Blushbook

Three pieces: a **Supabase project** (the database and auth), the **app** in a
Docker container on your server, and a **domain** pointing at it.

Budget about 40 minutes the first time. Nothing here costs money on day one —
Supabase's free tier covers you until you have real traffic.

> **Before you send this link to anyone:** the public booking page (`/{slug}`)
> is not built yet. A tech can sign up, add her services and hours, and copy
> her link from the Share tab — and that link will 404. Deploy now to prove
> the setup end to end, but hold off on the Instagram bio until step 2 of the
> build order ships.

---

## 1. Supabase

### Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a project.
2. Pick the region closest to your clients — every booking page load is a
   round trip to it.
3. Save the database password somewhere safe. You will rarely need it, and it
   cannot be recovered, only reset.

### Run the migration

This is the step that creates Blushbook's tables. Without it, signup fails,
because the trigger that gives each new account its profile lives in here.

1. Open **SQL Editor → New query**.
2. Paste the entire contents of
   `supabase/migrations/20260917120000_init.sql`.
3. Run it. It should finish with no errors.

To confirm it worked, open **Table Editor**. You should see `profiles`,
`services`, `availability`, `blocked_dates` and `bookings`, each with the
green *RLS enabled* badge.

<details>
<summary>Or, with the Supabase CLI</summary>

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

</details>

### Copy the API credentials

**Project Settings → API**. You need two values:

| Value                     | Goes into                       |
| ------------------------- | ------------------------------- |
| Project URL               | `NEXT_PUBLIC_SUPABASE_URL`      |
| `anon` / `public` key     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

The `anon` key is safe in the browser — that is what row-level security is
for. The **`service_role` key is not**. It bypasses every policy in the
database. Do not put it in any `NEXT_PUBLIC_*` variable, and do not paste it
into a chat window. Nothing in the app needs it yet; the Paddle webhook will,
in build step 4.

### Point auth at your domain

**Authentication → URL Configuration**:

- **Site URL**: `https://blushbook.app` (your real domain)
- **Redirect URLs**: add both
  - `https://blushbook.app/auth/callback`
  - `http://localhost:3000/auth/callback` (so local dev keeps working)

Magic links to any URL not on this list are rejected. This is the single most
common reason login "silently does nothing" after a deploy.

### Email

The built-in email sender is rate limited to a handful of messages per hour —
fine for testing, not for real signups. Before launch, add your own SMTP
provider under **Authentication → Emails → SMTP Settings** (Resend, Postmark
and Brevo all have usable free tiers).

---

## 2. The app, on your server

### What the server needs

- Docker
- A domain with an `A` record pointing at the server's IP
- Ports 80 and 443 open

[Coolify](https://coolify.io) is the easiest way to manage this — it handles
HTTPS certificates, rebuilds on push, and restarts. Install it with:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Then open `http://<your-server-ip>:8000` and create your admin account.

### Create the application in Coolify

1. **New Resource → Application → Public Repository** (or connect GitHub).
2. Build pack: **Dockerfile**.
3. Port: **3000**.
4. Set the domain to `https://blushbook.app`. Coolify requests the certificate
   for you.
5. Health check path: `/api/health`.

### Environment variables — read this part carefully

This is the one thing that reliably goes wrong. `NEXT_PUBLIC_*` values are
**compiled into the browser bundle when the image is built**, not read when
the container starts. So each one has to be set in *both* places, and changing
one means a **rebuild**, not just a restart.

In Coolify, add these and tick **"Build Variable"** on all three:

| Variable                        | Example                            |
| ------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://abcdefgh.supabase.co`     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...`                    |
| `NEXT_PUBLIC_SITE_URL`          | `https://blushbook.app`            |

`NEXT_PUBLIC_SITE_URL` is what magic links and the Share tab are built from.
If it is wrong, login redirects land on the wrong host. It must have **no
trailing slash**.

The build fails loudly if any of the three is missing, rather than shipping an
image that only breaks when someone tries to log in.

### Deploy

Hit **Deploy**. First build takes a few minutes.

<details>
<summary>Or, plain Docker without Coolify</summary>

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://abcdefgh.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..." \
  --build-arg NEXT_PUBLIC_SITE_URL="https://blushbook.app" \
  -t blushbook .

docker run -d --name blushbook -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="https://abcdefgh.supabase.co" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..." \
  -e NEXT_PUBLIC_SITE_URL="https://blushbook.app" \
  blushbook
```

You would then put Caddy or nginx in front for HTTPS.

</details>

---

## 3. Check it worked

In order, because each step depends on the one before:

1. `https://blushbook.app/api/health` returns `{"status":"ok"}`.
2. The landing page loads, in your brand colours, with the phone demo
   responding to taps.
3. `https://blushbook.app/dashboard` redirects you to `/login`.
4. Enter your email on `/login`. The link arrives, and clicking it lands you
   on the dashboard rather than back at the login page.
5. The dashboard shows the setup checklist — meaning the migration ran and
   your profile row was created by the trigger.
6. Add a service. Reload. It is still there. That proves the whole chain:
   session cookie, RLS policy, and write path.

If step 4 loops back to `/login`, it is almost always the redirect URL list in
Supabase, or a `NEXT_PUBLIC_SITE_URL` that disagrees with the domain you
actually visited.

---

## Ongoing

**Deploying a change.** Push to the branch Coolify is watching. It rebuilds
and swaps the container over.

**Changing the database.** Add a new file under `supabase/migrations/` rather
than editing the existing one — the original has already run, and re-running
it would fail. Name it with a later timestamp.

**Backups.** Supabase's free tier keeps daily backups for 7 days. Before
taking real money, move to a paid tier for point-in-time recovery. Your
techs' booking history is not something you want to lose.

**Logs.** Coolify shows container logs per deployment. Supabase logs live
under **Logs & Analytics**, and are where failed auth attempts and rejected
RLS queries show up.
