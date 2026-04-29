import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeader } from "@/components/marketing/section";
import { FinalCallCta } from "@/components/marketing/final-cta";
import {
  BUSINESS_NAME,
  EMAIL,
  EMAIL_HREF,
} from "@/lib/marketing/brand";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

const TITLE = "Privacy Policy | Rose Concrete";
const DESCRIPTION =
  "How Rose Concrete and Development collects, uses, and protects information from website visitors and lead-form submissions.";
const LAST_UPDATED = "April 28, 2026";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/privacy-policy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "Privacy Policy", href: "/privacy-policy" },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="border-b border-brand-100 bg-cream-50/50"
      >
        <ol className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 py-3 text-xs text-brand-700/70 sm:px-6">
          <li>
            <Link href="/" className="hover:text-accent-600">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-brand-800" aria-current="page">
            Privacy Policy
          </li>
        </ol>
      </nav>

      <Section tone="cream" className="border-b border-brand-100 pt-10 sm:pt-14">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          Legal
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-brand-700/70">
          Last updated: {LAST_UPDATED}
        </p>
      </Section>

      <Section tone="white">
        <div className="prose prose-lg max-w-3xl text-brand-700 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-brand-900 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1">
          <p>
            {BUSINESS_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
            &ldquo;our&rdquo;) operates this website. This Privacy Policy
            explains what information we collect when you use the site or
            submit a quote request, and how we handle that information.
          </p>

          <h2>Information we collect</h2>
          <p>
            When you submit our contact form to request a quote, we collect:
          </p>
          <ul>
            <li>Your name</li>
            <li>Phone number</li>
            <li>Email address (if provided)</li>
            <li>ZIP code (if provided)</li>
            <li>Project address (if provided)</li>
            <li>Project type and description (if provided)</li>
            <li>The page on our site you submitted from (for attribution)</li>
            <li>
              Standard request metadata (IP, browser user-agent, timestamp)
              for spam prevention
            </li>
          </ul>
          <p>
            We also use third-party analytics on this site that may collect
            aggregated, anonymized information about how visitors interact
            with our pages (page views, click events, device type). See
            &ldquo;Cookies and analytics&rdquo; below.
          </p>

          <h2>How we use it</h2>
          <ul>
            <li>To respond to your quote request by phone, text, or email</li>
            <li>To schedule on-site visits and send confirmations</li>
            <li>To follow up on active and prior projects</li>
            <li>To improve our site and understand which pages produce leads</li>
            <li>
              To meet legal, tax, and California Contractors State License
              Board record-keeping obligations
            </li>
          </ul>

          <h2>Sharing</h2>
          <p>
            We do not sell your information. We share submitted form data
            only with the service providers we use to operate the business:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — database hosting where leads and
              client records are stored
            </li>
            <li>
              <strong>Resend</strong> — sends the email confirmation to you
              and the notification to Ronnie
            </li>
            <li>
              <strong>OpenPhone</strong> — sends the SMS confirmation from
              Ronnie&apos;s business line
            </li>
            <li>
              <strong>Vercel</strong> — hosts this website
            </li>
            <li>
              <strong>Google Analytics 4 + Google Ads</strong> — measures
              site traffic and conversion attribution (anonymized aggregate
              data only)
            </li>
          </ul>
          <p>
            These providers are contractually bound to handle your data only
            for the purposes we instruct.
          </p>

          <h2>Cookies and analytics</h2>
          <p>
            We use Google Analytics 4 and Google Ads conversion tracking on
            this site. These services use cookies and similar technologies to
            measure how visitors find and use our pages. You can opt out of
            Google&apos;s tracking by installing the{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent-700 underline hover:text-accent-800"
            >
              Google Analytics opt-out browser add-on
            </a>
            .
          </p>

          <h2>Your rights</h2>
          <p>
            California residents (and others) may request access to, deletion
            of, or correction of personal information we hold about them.
            Email{" "}
            <a
              href={EMAIL_HREF}
              className="text-accent-700 underline hover:text-accent-800"
            >
              {EMAIL}
            </a>{" "}
            with the request and we will respond within 30 days.
          </p>

          <h2>Data retention</h2>
          <p>
            We retain lead and client records for the duration of the customer
            relationship plus the period required by California tax and CSLB
            record-keeping rules (typically 4–7 years from the last
            transaction). Leads that don&apos;t convert may be retained for
            up to 2 years for follow-up, then deleted on request or in our
            normal data-cleanup cycle.
          </p>

          <h2>Children</h2>
          <p>
            This site is directed at adult homeowners and property managers.
            We do not knowingly collect information from children under 13.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The
            &ldquo;Last updated&rdquo; date at the top of the page reflects
            the most recent change. Material changes will be highlighted on
            the homepage for at least 30 days.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this Privacy Policy or about data we hold about
            you:{" "}
            <a
              href={EMAIL_HREF}
              className="text-accent-700 underline hover:text-accent-800"
            >
              {EMAIL}
            </a>
            .
          </p>

          <hr className="my-10 border-brand-100" />
          <p className="text-sm italic text-brand-700/60">
            This Privacy Policy is provided as general information about how
            we handle data and is not legal advice. For questions about your
            specific legal rights, consult a California-licensed attorney.
          </p>
        </div>
      </Section>

      <FinalCallCta />
    </>
  );
}
