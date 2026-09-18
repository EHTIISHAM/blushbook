# Deploying Blushbook

The pipeline: **push to GitHub → Actions builds the image → GHCR → the VM
pulls it**. The build never runs on your server, so it cannot compete with the
running app for memory.

Nothing gets installed on the VM except Docker. The whole stack is two
containers described by one `docker-compose.yml`: the app, and Caddy in front
of it for HTTPS. No agent, no daemon rewriting your system config.

> **Before you send the link to anyone:** the public booking page (`/{slug}`)
> does not exist yet. A tech can sign up, add services and hours, and copy her
> link from the Share tab — and that link will 404. Deploy now to prove the
> pipeline; hold the Instagram bio until build step 2 ships.

---

## Status

Already done:

- Supabase project exists and the migration has been applied. Verified: the
  tables are there, RLS is on, `bookings` is unreadable by anonymous
  visitors, and `profiles` refuses `select=*` so the Paddle columns stay
  private.
- The domain's DNS points at the VM.

Still to do: everything below.

---

## 1. Push the repo to GitHub

Actions needs somewhere to run. The repo can be private — GHCR works either
way.

```bash
git remote add origin git@github.com:<owner>/blushbook.git
git push -u origin master
```

The workflow triggers on both `main` and `master`, so either name is fine.

## 2. Repository secrets

**Settings → Secrets and variables → Actions → New repository secret.**

| Secret                          | Value                                             |
| ------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://<ref>.supabase.co`                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` key from Supabase                      |
| `NEXT_PUBLIC_SITE_URL`          | `https://<your-domain>` — no trailing slash       |
| `VM_HOST`                       | the VM's IP or hostname                           |
| `VM_USER`                       | the SSH user the deploy logs in as                |
| `VM_SSH_KEY`                    | the **private** half of a deploy-only key         |
| `VM_SSH_KNOWN_HOSTS`            | optional but recommended, see below               |

The first three are also Docker build arguments, because `NEXT_PUBLIC_*`
values get compiled into the browser bundle. That is why changing your domain
means a **rebuild**, not a restart.

Do not add the `service_role` key. Build args are recoverable from image
history, and nothing needs it until build step 4.

### The deploy key

Generate a key that exists only for this, on your own machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/blushbook_deploy -C "github-actions" -N ""
ssh-copy-id -i ~/.ssh/blushbook_deploy.pub <user>@<vm-host>
```

Put the **private** key (`~/.ssh/blushbook_deploy`, the file without `.pub`)
into `VM_SSH_KEY`, including the `BEGIN`/`END` lines.

For `VM_SSH_KNOWN_HOSTS`, run this and paste the output:

```bash
ssh-keyscan -H <vm-host>
```

Without it the workflow trusts whatever answers on first contact and warns in
the log. Pinning it takes a minute and removes that gap.

## 3. Bootstrap the VM, once

SSH in as the deploy user.

**Docker**, if it is not already there:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in for the group change to apply. Confirm with
`docker compose version`.

**Log in to GHCR** so the VM can pull a private image. Create a classic
personal access token on GitHub with only the `read:packages` scope
(Settings → Developer settings → Personal access tokens → Tokens (classic)):

```bash
echo "<your-read-packages-token>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

This is stored in `~/.docker/config.json`, so the deploy script never needs a
registry token of its own.

**Create the directory and config:**

```bash
sudo mkdir -p /opt/blushbook
sudo chown "$USER":"$USER" /opt/blushbook
cd /opt/blushbook
```

Copy `docker-compose.yml`, `Caddyfile` and `.env.production.example` from the
repo into it, then:

```bash
mv .env.production.example .env
chmod 600 .env
nano .env    # fill in every value
```

`SITE_DOMAIN` is the bare hostname, no scheme. `NEXT_PUBLIC_SITE_URL` is the
full `https://` URL. They must describe the same host, and that host must
match the redirect URL in Supabase exactly.

Make sure ports 80 and 443 are open, or Caddy cannot complete the ACME
challenge and you get no certificate.

## 4. Supabase redirect URLs

**Authentication → URL Configuration:**

- **Site URL**: `https://<your-domain>`
- **Redirect URLs**: add both
  - `https://<your-domain>/auth/callback`
  - `http://localhost:3000/auth/callback`

A magic link to a URL not on this list is rejected. This is the single most
common reason login appears to do nothing after a first deploy.

While you are in Supabase: the built-in email sender is rate limited to a few
messages an hour. Fine for testing yourself, not for real signups. Add your
own SMTP under **Authentication → Emails → SMTP Settings** before launch.

## 5. Deploy

Push to `master`, or run the workflow by hand from the Actions tab.

The run does four things in order: typecheck and lint, build and push the
image to GHCR, SSH in and swap the container, then poll
`https://<your-domain>/api/health` until it answers. If that last step fails,
the deploy is red even though the container started — which is the point.

---

## Check it worked

In order, because each depends on the one before:

1. `https://<your-domain>/api/health` returns `{"status":"ok"}`.
2. The landing page loads over HTTPS with a valid certificate, in your brand
   colours, and the phone demo responds to taps.
3. `/dashboard` redirects you to `/login`.
4. Enter your email. The link arrives and lands you on the dashboard rather
   than back at the login page.
5. The dashboard shows the setup checklist — proving your profile row was
   created by the signup trigger.
6. Add a service, reload, and it is still there. That exercises the whole
   chain: session cookie, RLS policy, and write path.

If step 4 loops back to `/login`, it is nearly always the Supabase redirect
list, or a `NEXT_PUBLIC_SITE_URL` that disagrees with the host you actually
visited.

## Rolling back

Every build is tagged with its commit SHA, and the deploy pins `.env` to that
exact tag rather than `latest`. To go back, re-run the older green workflow
from the Actions tab.

By hand on the VM:

```bash
cd /opt/blushbook
sed -i 's|^APP_IMAGE=.*|APP_IMAGE=ghcr.io/<owner>/<repo>:<old-sha>|' .env
docker compose pull app && docker compose up -d
```

## Day to day

**Deploying** — push to `master`.

**Changing the database** — add a new file under `supabase/migrations/`.
Never edit the applied one; re-running it would fail. Name it with a later
timestamp and paste it into the Supabase SQL editor.

**Changing the domain** — update the secret, `.env` on the VM, and the
Supabase redirect list, then **rebuild**. A restart is not enough.

**Logs** — `docker compose logs -f app` on the VM. Supabase's own logs, under
**Logs & Analytics**, are where rejected auth attempts and blocked RLS
queries show up.

**Backups** — Supabase's free tier keeps 7 days of daily backups. Move to a
paid tier for point-in-time recovery before you take real money; your techs'
booking history is not something to lose.
