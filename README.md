# Rose Concrete — Operations Platform

Custom web app + crew PWA replacing Jobber. Scope, phases, and decisions live in the approved plan:
`C:\Users\thoma\.claude\plans\drifting-discovering-biscuit.md`

## North Star

> **Ronnie pours concrete. The computer does everything else.**

## Stack

| Layer       | Tool                               |
| ----------- | ---------------------------------- |
| Frontend    | Next.js 15 (App Router), Tailwind  |
| Auth/DB     | Supabase (Postgres + Auth + RLS)   |
| Photos      | Supabase Storage                   |
| Hosting     | Vercel                             |
| Signatures  | DocuSign (via MCP)                 |
| Phones      | OpenPhone (via MCP)                |
| Accounting  | QuickBooks (via MCP)               |

## First-time setup

1. **Supabase project**
   - Create a project at https://supabase.com/dashboard
   - Project Settings → API → copy the URL, anon key, and service_role key
   - Project Settings → Database → paste the contents of `migrations/001_init.sql` into the SQL editor and run

2. **Environment**
   - `cp .env.local.example .env.local`
   - Fill in the Supabase values
   - Leave DocuSign template ID empty until the MCP beta access comes through

3. **Install & run**
   ```bash
   npm install
   npm run dev
   ```
   Visit http://localhost:3000

4. **Deploy**

   See [`DEPLOY.md`](./DEPLOY.md) for the full end-to-end walkthrough
   — Supabase project creation, env vars, Vercel domain wiring,
   cron setup, Gmail OAuth bootstrap, and a checklist for the first
   production tenant. Short version: push to GitHub, import into
   Vercel, paste env vars, run migrations via `supabase db push`,
   hit `/signup` from the deployed domain.

5. **Logo**
   - Drop the Rose Concrete logo into `public/icon-192.png` (192x192) and `public/icon-512.png` (512x512)
   - Phone "Add to Home Screen" will use this as the app icon

## Module feature flags

Every major capability is behind a row in `public.feature_flags`. Flip them on as you reach each phase.

| Flag                       | Phase | Default |
| -------------------------- | ----- | ------- |
| `quotes_optional_items`    | 1     | on      |
| `crew_mobile_view`         | 1     | on      |
| `docusign_auto_send`       | 1     | off     |
| `openphone_intake`         | 1     | off     |
| `qbo_job_costing`          | 2     | off     |
| `marketing_dashboard`      | 2     | off     |
| `daily_email_digest`       | 2     | off     |
| `social_post_drafter`      | 2     | off     |
| `gdrive_photo_sync`        | 2     | off     |
| `google_ads_shadow_mode`   | 2     | off     |
| `google_ads_autonomous`    | 2.5   | off     |
| `duda_monitor`             | 2.5   | off     |
| `material_ordering`        | 3     | off     |

## Key paths

- `app/` — routes (App Router). `app/(dashboard)` for the office app, `app/q/[token]` for public quote pages, `app/crew` for the PWA-targeted crew views.
- `migrations/001_init.sql` — full initial schema including RLS.
- `lib/supabase/` — server + browser Supabase clients.
- `scripts/import-jobber.ts` — runs once in Phase 0 to seed the new DB from a Jobber JSON export.
- `public/manifest.webmanifest` — PWA manifest (icon + standalone display).

## Phase 0 tasks (blocking before Phase 1 can finish)

- [ ] Ronnie requests DocuSign MCP beta access: https://docusign.co1.qualtrics.com/jfe/form/SV_7QhPzWDlaF0BuyG
- [ ] Reconnect Jobber MCP credentials (flagged as broken in April 1 morning report)
- [ ] Reconnect OpenPhone MCP credentials
- [ ] Ronnie provides the Rose Concrete logo (square 1024x1024+)
- [ ] Export all Jobber clients/jobs/quotes to `scripts/jobber-export/*.json`
- [ ] Confirm the DocuSign template name Ronnie uses for concrete contracts
- [ ] Confirm non-refundable deposit percentage (plan assumes current 50%)
