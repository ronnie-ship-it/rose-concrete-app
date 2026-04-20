-- Rose Concrete — Seed the Business Profile singleton with Ronnie's real info
--
-- Migration 030 created the `business_profile` table but seeded it with
-- the placeholder company name "Rose Concrete". This fills in Ronnie's
-- actual business details so the client hub, receipts, and Google
-- listings render correctly the moment the profile module lights up.
--
-- Idempotent: only touches the singleton row, and only sets fields that
-- are currently null/default so a later hand-edit in the UI isn't
-- reverted on re-run.

update public.business_profile
   set company_name = coalesce(nullif(company_name, 'Rose Concrete'), 'Rose Concrete and Development LLC'),
       legal_name = coalesce(legal_name, 'Rose Concrete and Development LLC'),
       phone = coalesce(phone, '+16195379408'),
       email = coalesce(email, 'ronnie@sandiegoconcrete.ai'),
       website = coalesce(website, 'https://www.sandiegoconcrete.ai/'),
       city = coalesce(city, 'San Diego'),
       state = coalesce(state, 'CA'),
       license_number = coalesce(license_number, '1130763'),
       tagline = coalesce(tagline, 'Family-owned concrete contractor serving San Diego County.')
 where singleton = true;

-- If no row exists (fresh install that skipped migration 030's own seed),
-- insert a fully-populated one.
insert into public.business_profile (
  singleton, company_name, legal_name, phone, email, website,
  city, state, license_number, tagline
)
select true, 'Rose Concrete and Development LLC',
       'Rose Concrete and Development LLC',
       '+16195379408',
       'ronnie@sandiegoconcrete.ai',
       'https://www.sandiegoconcrete.ai/',
       'San Diego',
       'CA',
       '1130763',
       'Family-owned concrete contractor serving San Diego County.'
where not exists (select 1 from public.business_profile where singleton = true);
