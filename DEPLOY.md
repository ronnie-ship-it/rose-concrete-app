# Deploying the Rose Concrete app to Vercel

End-to-end instructions for taking a fresh clone of this repo and
getting it live on Vercel with Supabase, Stripe-less QBO invoicing,
Resend email, OpenPhone SMS, and Gmail auto-attach wired up.

**Time estimate:** ~45 min first time, ~15 min for each subsequent
tenant. You can skip the optional integrations (Gmail, OpenPhone,
Web Push, QBO, Anthropic) and come back to them later — the app
runs without them; they just no-op.

---

## 0. Prereqs

- Node 20+ and npm installed locally
- A GitHub account (Vercel pulls from a repo)
- A credit card for Supabase + Vercel (both have free tiers that
  fit this app's usage, but billing needs to be enabled for the
  Gmail API + Google OAuth consent screen)

---

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create rose-concrete-app --private --source . --push
```

…or push to an existing GitHub repo via `git remote add`.

---

## 2. Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
   Region: `us-west` (closest to San Diego). Save the database
   password somewhere.
2. Wait ~2 min for provisioning.
3. From the project dashboard:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role** key (⚠ server-only) →
     `SUPABASE_SERVICE_ROLE_KEY`

### Run migrations

```bash
# Once — link the local checkout to the remote project.
npx supabase link --project-ref <your-project-ref>

# Then push all migrations in order.
npx supabase db push
```

Or paste the files in `migrations/` into the Supabase SQL editor
**in order** (001 → 040). `db push` is strongly preferred — it
tracks state so re-running is a no-op.

### Storage buckets

Migration 003 creates the `attachments` + `photos` buckets already
(check the Storage tab in Supabase to confirm). If missing, create
them manually:

- `attachments` → private
- `photos` → private (we serve via signed URLs)

---

## 3. Vercel project

1. Go to <https://vercel.com/new> → import your GitHub repo.
2. Framework preset should auto-detect Next.js.
3. Build command: `next build` (default). Install: `npm install`.
4. **Do NOT deploy yet.** Click "Environment Variables" and paste
   everything from section 4 first.

### Connect the app subdomain

Once the first deploy succeeds, go to **Settings → Domains**:

- Primary domain: `app.<yourcompany>.com`
- Add `www.<yourcompany>.com` and `<yourcompany>.com` too if you
  want the marketing apex on the same Vercel project (the
  middleware in `middleware.ts` routes host-based — app.* gets the
  dashboard, everything else gets the marketing site).

Vercel will hand you CNAME + A records to add at your DNS provider.

---

## 4. Environment variables

All of these land in **Vercel → Settings → Environment Variables**
(select "Production" + "Preview" + "Development" unless noted).
Mirror them in `.env.local` for dev.

### Required — nothing works without these

```ini
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # server-only

# The public origin of the app (no trailing slash). Used for
# magic-link redirects, customer-form URLs, etc.
NEXT_PUBLIC_APP_URL=https://app.yourcompany.com

# Used by the Vercel cron scheduler to authenticate GET requests
# to /api/cron/*. Pick a long random string (32+ chars).
CRON_SECRET=<openssl rand -hex 32>
```

### Optional — email (Resend)

Quote sends, customer-form delivery, hub logins, review-request
emails all go through Resend.

```ini
RESEND_API_KEY=re_xxxxxxxxxxxx
LEAD_NOTIFICATION_FROM=Your Company <leads@yourcompany.com>
RESEND_REPLY_TO=owner@yourcompany.com
LEAD_NOTIFICATION_EMAIL=owner@yourcompany.com
```

Sign up at <https://resend.com> (free tier = 3k emails/month).
Verify the domain before sending from
`leads@yourcompany.com`; until then use
`Your Company <onboarding@resend.dev>`.

### Optional — OpenPhone (SMS + MMS auto-attach)

```ini
OPENPHONE_API_KEY=<from OpenPhone Settings → API keys>
OPENPHONE_PHONE_NUMBER_ID=<optional; pin sends to one number>
```

### Optional — Gmail auto-attach

Three env vars. See `scripts/gmail-oauth-bootstrap.js` for the
one-time token mint flow.

```ini
GMAIL_CLIENT_ID=<from Google Cloud Console OAuth>
GMAIL_CLIENT_SECRET=<paired secret>
GMAIL_REFRESH_TOKEN=<from the bootstrap script>
```

### Optional — Web Push

```ini
VAPID_PUBLIC_KEY=<from `npx web-push generate-vapid-keys`>
VAPID_PRIVATE_KEY=<paired private key>
VAPID_SUBJECT=mailto:owner@yourcompany.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same as VAPID_PUBLIC_KEY>
```

### Optional — QuickBooks Online

```ini
QBO_CLIENT_ID=<Intuit developer app OAuth client id>
QBO_CLIENT_SECRET=<paired secret>
QBO_COMPANY_ID=<Intuit realmId>
QBO_REFRESH_TOKEN=<from QBO OAuth flow>
```

### Optional — Anthropic (photo alt-text)

```ini
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Optional — Call tracking

```ini
CALL_TRACKING_WEBHOOK_SECRET=<shared secret with your call tracker>
```

---

## 5. Supabase auth configuration

**This is the step people get wrong.** If the Site URL isn't set
to the app subdomain, magic links land on the marketing homepage
with a `?code=...` query and the user sees a 404 or your marketing
page instead of `/dashboard`.

1. **Authentication → Providers** → enable Email (the default).
2. **Authentication → URL Configuration** (the config with the
   most traps):
   - **Site URL** → `https://app.yourcompany.com`
     — NOT the marketing apex, NOT the www variant.
     The Site URL is Supabase's fallback when `emailRedirectTo`
     isn't in the allowlist. If it points at your marketing
     domain, magic links land there instead of on the app.
   - **Redirect URLs** (allowlist — must include every host the
     callback might run on):
     - `https://app.yourcompany.com/auth/callback`
     - `https://app.yourcompany.com/auth/callback?next=/dashboard`
     - `https://app.yourcompany.com/auth/callback?next=/crew`
     - Optional, for Vercel previews: `https://*-yourteam.vercel.app/auth/callback`
     - Optional, for local dev: `http://localhost:3000/auth/callback`

   Even though the app's callback handler will bounce a misrouted
   callback from the apex to `app.*`, Supabase rejects any URL not
   in the allowlist before it ever redirects, so the allowlist
   still needs entries for every path you'll use.

3. **Authentication → Email Templates → Magic Link** — customize
   the template. The default works; branding is optional. The
   template uses `{{ .SiteURL }}` by default — if you override it,
   make sure the link still points at `{{ .ConfirmationURL }}` so
   Supabase fills in the signed redirect.

4. **Verify it end-to-end**:
   - From a private window, hit
     `https://app.yourcompany.com/signup`.
   - Enter a test email + company name.
   - Open the email (Supabase → Authentication → Users shows the
     last magic-link email in dev mode).
   - Click it. You should land on `/dashboard` inside the app
     subdomain with a brand-new workspace. If you land on the
     apex homepage with `?code=...` in the URL, Site URL isn't set
     right (step 5.2).

---

## 6. Deploy + smoke test

1. Back in Vercel, hit **Deploy**. First build takes ~4 min.
2. Once green, visit `https://app.yourcompany.com/signup`.
3. Enter your company name + email. You should receive a magic
   link email via Supabase.
4. Click the link → lands on `/dashboard`. You're now admin of
   a fresh tenant with 14-day trial status.
5. Go to **Settings → Integrations** to confirm green dots for
   every env var you've set.

---

## 7. Vercel cron jobs

The repo's `vercel.json` already declares every cron (~18 schedules
covering payment reconcile, photo reminders, lead intake, etc.).
They auto-enable on first deploy.

### Cron auth — two-channel design

Each cron route accepts a request from EITHER source:

1. **Vercel's automatic cron scheduler** sends `x-vercel-cron: 1`
   on every scheduled invocation. No secret needed. This header
   can't be forged from outside — Vercel strips inbound `x-vercel-*`
   headers from public traffic.
2. **External triggers** (curl from a terminal, GitHub Actions,
   another scheduler) must send `Authorization: Bearer $CRON_SECRET`.
   The secret you set in Vercel env must match.

The shared `lib/cron-auth.ts` helper handles both. So:

- **If you DON'T set `CRON_SECRET`**: Vercel's cron still works
  (uses the header). External triggers get 401.
- **If you DO set `CRON_SECRET`**: both channels work.

### Setting `CRON_SECRET`

Recommended even though it's optional, so you can curl-test:

```bash
# Generate a value:
openssl rand -hex 32
```

Then in Vercel:
**Settings → Environment Variables → Add**:
- Name: `CRON_SECRET`
- Value: paste the openssl output
- Environments: ✓ Production ✓ Preview ✓ Development
- Save

Mirror in `.env.local` for local dev:
```
CRON_SECRET=<your-generated-value>
```

### Test a cron locally

```bash
curl -i http://localhost:3000/api/cron/payment-reconcile \
  -H "Authorization: Bearer $CRON_SECRET"
```

Should return `200 {"ok": true, ...}` (or `200 {"ok": true, "skipped": "..."}`
when the relevant feature flag is off).

### Verify on Vercel

- **Vercel → Settings → Cron Jobs** should show ~18 scheduled
  tasks ranging from "every 15 min" to "daily".
- The first few execute within 15 min of deploy. Check
  Vercel → Logs → Functions → filter to `/api/cron/` for errors.
- A 401 from `/api/cron/*` after a deploy means BOTH the header
  AND the bearer check failed — most often this is because
  `lib/cron-auth.ts` wasn't deployed yet (force a redeploy).

---

## 8. Adding teammates

From the admin dashboard:

1. Settings → Manage team → enter teammate email + role
   (admin / office / crew).
2. They receive a magic link; the handle_new_user trigger pins
   their profile to your tenant via the invite token.

(Invite flow details live in `app/dashboard/settings/team/`.)

---

## 9. Custom domains per tenant (optional, future)

Today every tenant lives under `app.yourcompany.com`. A future
round can add per-tenant subdomains (`bayarea.app.yourcompany.com`,
`alpha-concrete.app.yourcompany.com`) via Vercel's wildcard
domains + middleware host → tenant_id lookup. Not needed to ship.

---

## 10. Monitoring + backups

### Backups

Supabase automatically takes daily backups on the paid plan
($25/mo) and retains 7 days. On the free plan you need to trigger
them manually or set up a pg_dump cron.

For production, upgrade to **Pro** before you have real customer
data.

### Errors

- Vercel Logs shows runtime errors in server components and API
  routes.
- Client-side errors need Sentry or similar (not wired today —
  plan a future round).

### Uptime

Add <https://uptimerobot.com> pointed at
`https://app.yourcompany.com/api/health` (404 today; a 30-line
route returning `{ok:true}` is a 5-min follow-up).

---

## 11. Upgrading a tenant's plan

Today plan is display-only (`tenants.plan` = starter / pro /
enterprise). Billing via Stripe is a separate module. For now,
upgrade manually:

```sql
update public.tenants
set plan = 'pro', status = 'active', trial_ends_at = null
where id = '<tenant id>';
```

---

## 12. Rollback

- **Code rollback:** Vercel → Deployments → click any previous
  deploy → "Promote to Production".
- **DB rollback:** Supabase doesn't auto-rollback migrations.
  Take a manual backup before running a destructive migration
  (migrations 001-040 are all additive/idempotent; rollback is
  mostly "re-run the prior migration's DROP statements").

---

## 13. Checklist for your first production tenant

- [ ] Supabase project created, migrations 001-040 applied
- [ ] Vercel project deployed, domain pointed at `app.<domain>`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + anon + service_role set
- [ ] `NEXT_PUBLIC_APP_URL` = prod URL
- [ ] `CRON_SECRET` set
- [ ] Supabase **Site URL** matches prod URL
- [ ] Supabase auth redirects include `/auth/callback`
- [ ] Resend API key set + domain verified
- [ ] OpenPhone API key set + number id pinned
- [ ] Gmail OAuth + refresh token set (via bootstrap script)
- [ ] VAPID keys set for push
- [ ] QBO OAuth tokens set (if using invoicing)
- [ ] Test signup flow at `/signup` from incognito — confirm
      magic link arrives + lands on a fresh tenant dashboard
- [ ] `Settings → Integrations` shows all green dots for the
      integrations you configured

---

## 14. Where to look when something breaks

| Symptom | Where to check |
|---|---|
| "Missing tenant on this session" | User doesn't have a profile row — re-run migration 002 |
| Magic links don't arrive | Supabase Auth logs → Email delivery; also Resend dashboard |
| Cron not firing | Vercel → Cron Jobs; verify `CRON_SECRET` matches |
| QBO invoice not generating | Check QBO_* env vars; logs in Vercel under `/api/.../actions.ts` |
| Customer-form link 404 | `customer_forms` row's `token` column — `/forms/<token>` is the URL |
| Crew photo reminder silent | 4pm PT = 23:00 UTC, confirm the cron is scheduled for `0 23 * * *` |
| Push notifications silent | `Settings → Notifications` "Send test push" button shows error |

Everything else: check Vercel → Functions → Logs. The app logs
enough context to diagnose (`[push]`, `[gmail]`, `[openphone]`,
`[automation]` prefixes are searchable).
