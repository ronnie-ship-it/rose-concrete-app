import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/marketing/section";
import { FinalCallCta } from "@/components/marketing/final-cta";
import {
  BUSINESS_NAME,
  EMAIL,
  EMAIL_HREF,
  LICENSE,
} from "@/lib/marketing/brand";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

const TITLE = "Terms of Service | Rose Concrete";
const DESCRIPTION =
  "Terms governing use of the Rose Concrete and Development website and the quote-request form.";
const LAST_UPDATED = "April 28, 2026";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/terms-of-service` },
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "Terms of Service", href: "/terms-of-service" },
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
            Terms of Service
          </li>
        </ol>
      </nav>

      <Section tone="cream" className="border-b border-brand-100 pt-10 sm:pt-14">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          Legal
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-brand-700/70">
          Last updated: {LAST_UPDATED}
        </p>
      </Section>

      <Section tone="white">
        <div className="prose prose-lg max-w-3xl text-brand-700 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-brand-900 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1">
          <p>
            These Terms of Service govern your use of this website, owned and
            operated by {BUSINESS_NAME} ({LICENSE}). By using this site or
            submitting a quote-request form, you agree to these terms.
          </p>

          <h2>What this site is</h2>
          <p>
            This site provides general information about our concrete
            services, allows you to learn about projects we&apos;ve completed,
            and lets you submit a request for a quote. This site is{" "}
            <strong>not</strong> itself a service contract — any concrete
            work we perform for you is governed by a separately-signed
            written quote and contract.
          </p>

          <h2>Quote requests</h2>
          <p>
            Submitting our contact form does not create a service obligation
            on either side. We will respond to your inquiry, and if there&apos;s
            a fit we will send you a written quote that becomes binding only
            after both parties sign.
          </p>

          <h2>Intellectual property</h2>
          <p>
            The content on this site — text, images, designs, page
            structure — is owned by {BUSINESS_NAME}. You may share links to
            our pages and reference our public information for personal,
            non-commercial purposes. You may not republish our content,
            scrape our project photos, or use our brand name in a way that
            implies affiliation without written permission.
          </p>

          <h2>Accuracy of information</h2>
          <p>
            We work to keep service descriptions, pricing context, and
            program information (e.g., the City of San Diego Safe Sidewalks
            Program) accurate, but program rules and pricing change. The
            authoritative source for any specific quote is the written quote
            we send you after a site visit.
          </p>

          <h2>Disclaimers</h2>
          <p>
            Information on this site is provided &ldquo;as is&rdquo; for
            general guidance only and does not constitute professional advice
            for your specific project. Before relying on any specific
            statement (e.g., permit requirements, ADA cross-slope
            specifications, City program eligibility), confirm with us
            during a quote or directly with the relevant city department.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the fullest extent permitted by California law, our liability
            arising out of your use of this website is limited to the amount
            you have paid us for use of this site (which is zero — the site
            is free to access). This limitation does not apply to liability
            arising from concrete work we perform under a separately-signed
            contract; that liability is governed by the written contract for
            the work.
          </p>

          <h2>Third-party links</h2>
          <p>
            This site may link to third-party services (e.g., Google
            Reviews, the City of San Diego program pages). We are not
            responsible for the content or practices of those sites.
          </p>

          <h2>Governing law</h2>
          <p>
            These Terms are governed by the laws of the State of California,
            without regard to conflict-of-laws principles. Any dispute
            arising from these Terms will be resolved in the state or
            federal courts located in San Diego County, California.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these Terms from time to time. The &ldquo;Last
            updated&rdquo; date at the top reflects the most recent change.
            Continued use of the site after a change means you accept the
            updated Terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these Terms:{" "}
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
            These Terms of Service are provided as a baseline framework for
            this website and are not legal advice. Before relying on any
            specific provision, consult a California-licensed attorney for
            your situation.
          </p>
        </div>
      </Section>

      <FinalCallCta />
    </>
  );
}
