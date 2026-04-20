# Social posting (Phase 2 — not built)

This folder is the future home of automatic project-photo posting to
Instagram, Facebook, and TikTok. Nothing in here ships in the current
release — the project_media subsystem (mig 033) lays the foundation,
but the social-post UI + provider integrations are a separate session.

## What's planned

Each project detail page will eventually grow a "Post to social" button
that:

1. Picks the best `phase = 'after'` photo on the project (highest
   `sort_order`, falling back to most recent — same ranking we use for
   `<RecentProjects />` on the marketing site).
2. Generates a caption via Claude using the project's service_type,
   city, and any human-edited caption already on the photo. Output is
   short, hashtag-light, brand-aligned.
3. Posts to the configured channels via the provider APIs:
   - **Instagram + Facebook**: Meta Graph API (Instagram Graph for
     business accounts, Facebook Pages API for FB feed). One OAuth flow
     per page; we store `feature_flags.config.meta_page_token` and
     `meta_ig_business_id`.
   - **TikTok**: TikTok for Business / Marketing API. OAuth flow,
     same shape.
4. Records the post in a new `social_posts` table linked back to
   `project_media.id` so we can show "Posted to IG · 2 weeks ago" on
   the project detail and skip re-posting the same photo.

## Recommended order of work

1. Build the caption generator (works against any project_media row,
   no provider needed). Lives in `lib/social/caption.ts`.
2. Add the `social_posts` table + status enum (`scheduled`, `posted`,
   `failed`).
3. Wire the Meta Graph API first — covers IG + FB in one integration.
4. TikTok last — its API is the highest-friction.

## What's already in place

- `project_media` table + storage bucket (mig 033).
- `lib/marketing/project-photos.ts` query helpers — the same selectors
  the social drafter will use to pick "best photo of this service type"
  etc.
- AI alt text via Claude (`lib/project-media/alt-text.ts`) — reuse the
  same fetch pattern for caption generation.
