import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeader } from "@/components/marketing/section";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { ServiceAreaList } from "@/components/marketing/service-area-list";
import { FinalCallCta } from "@/components/marketing/final-cta";
import { LeadForm } from "@/components/marketing/lead-form";
import { buttonClassNames } from "@/components/ui/button";
import {
  EMAIL,
  EMAIL_HREF,
  GOOGLE_REVIEW_URL,
  LICENSE,
  PHONE_DISPLAY,
  PHONE_SMS_HREF,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

const TITLE = "Contact Rose Concrete — San Diego Concrete Contractor";
const DESCRIPTION =
  "Call (619) 537-9408 or text us. Free quotes, fast response. San Diego County concrete contractor — driveways, patios, sidewalks, and the Safe Sidewalks Program.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/contact` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/contact`,
    siteName: "Rose Concrete",
    images: [
      { url: `${SITE_ORIGIN}/og-default.png`, width: 1200, height: 630 },
    ],
  },
};

export default function ContactPage() {
  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "Contact", href: "/contact" },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Breadcrumb */}
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
            Contact
          </li>
        </ol>
      </nav>

      {/* Hero with form on the right */}
      <Section tone="cream" className="border-b border-brand-100 pt-10 sm:pt-14">
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-12">
          <div className="md:pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
              Contact · San Diego County
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
              Talk to Ronnie.
            </h1>
            <p className="mt-5 text-lg text-brand-700">
              Call, text, or fill out the form. We&apos;ll text you back fast
              and get on the phone the same day.
            </p>

            {/* Big contact card */}
            <div className="mt-8 space-y-4">
              <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
                  Phone
                </p>
                <a
                  href={PHONE_TEL_HREF}
                  className="mt-1 block text-3xl font-extrabold text-brand-900 hover:text-accent-700 sm:text-4xl"
                >
                  {PHONE_DISPLAY}
                </a>
                <p className="mt-1 text-sm text-brand-700/80">
                  7 days · 7am–7pm · Most quotes returned same-week
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={PHONE_TEL_HREF}
                    className={buttonClassNames({
                      variant: "primary",
                      size: "lg",
                    })}
                  >
                    Call now
                  </a>
                  <a
                    href={PHONE_SMS_HREF}
                    className={buttonClassNames({
                      variant: "accent",
                      size: "lg",
                    })}
                  >
                    Text us
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
                  Email
                </p>
                <a
                  href={EMAIL_HREF}
                  className="mt-1 block break-all text-lg font-bold text-brand-900 hover:text-accent-700"
                >
                  {EMAIL}
                </a>
                <p className="mt-1 text-sm text-brand-700/80">
                  Send a photo of your project — Ronnie usually replies the
                  same day.
                </p>
              </div>

              <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
                  Service area
                </p>
                <p className="mt-1 text-base font-bold text-brand-900">
                  San Diego County, CA
                </p>
                <p className="mt-1 text-sm text-brand-700/80">
                  South Bay to North County. {LICENSE}.
                </p>
              </div>

              {/* Existing-customer ask. Past customers often land on Contact
                  for the phone number — surface the review CTA where they
                  already are, not buried in the footer. */}
              <div className="rounded-xl border border-accent-200 bg-accent-50/60 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
                  Already worked with us?
                </p>
                <p className="mt-1 text-sm text-brand-800">
                  A short Google review is the single most useful thing you can
                  do for a small contractor like us. Takes 60 seconds.
                </p>
                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={buttonClassNames({
                    variant: "accent",
                    size: "lg",
                    className: "mt-3",
                  })}
                >
                  <span aria-hidden="true">★</span>
                  Leave a Google review
                </a>
              </div>
            </div>
          </div>

          {/* Form on the right */}
          <div id="quote">
            <LeadForm
              eyebrow="Free quote · Fast response"
              title="Send us the details"
            />
          </div>
        </div>
      </Section>

      {/* Trust */}
      <Section tone="white" className="py-8 sm:py-10">
        <TrustBadges />
      </Section>

      {/* Hours table */}
      <Section tone="cream">
        <SectionHeader
          eyebrow="Hours"
          title="When you can reach us"
          sub="On the phone 7 days a week. Quotes happen during the week; emergency callbacks any day."
        />
        <div className="overflow-hidden rounded-xl border border-brand-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-brand-700">
                  Day
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-brand-700">
                  Phone
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-brand-700">
                  On-site quotes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 bg-white">
              {[
                ["Mon–Fri", "7am – 7pm", "By appointment"],
                ["Saturday", "8am – 5pm", "By appointment"],
                ["Sunday", "Limited", "Emergency only"],
              ].map(([day, phone, onsite]) => (
                <tr key={day}>
                  <td className="px-4 py-3 font-bold text-brand-900">{day}</td>
                  <td className="px-4 py-3 text-brand-700">{phone}</td>
                  <td className="px-4 py-3 text-brand-700">{onsite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <ServiceAreaList />

      <FinalCallCta />
    </>
  );
}
