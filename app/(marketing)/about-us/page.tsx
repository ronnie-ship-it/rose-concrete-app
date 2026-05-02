import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FinalCallCta } from "@/components/marketing/final-cta";
import {
  GOOGLE_REVIEW_URL,
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
} from "@/lib/marketing/brand";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  localBusinessJsonLd,
  SITE_ORIGIN,
} from "@/lib/marketing/schema";

/**
 * About page — rebuilt 2026-04-30 to spec.
 *
 * Single short narrative: who Rose Concrete is, why folks should hire
 * us, and how to get in touch. Replaces the longer scaffold v2 with
 * its TODO banners, "How we run jobs" / "Why concrete" / Licenses
 * blocks. Spec lives in duda-site-content/WEBSITE_COPY_DRAFT.md.
 *
 * Page photo (rose-shirt-crew.jpg) shows Thomas Rose with the crew on
 * a job site — also used in the homepage Owner's note section.
 */

const TITLE =
  "About Rose Concrete — Family-Run, Veteran-Owned Concrete Contractor in San Diego";
const DESCRIPTION =
  "Rose Concrete and Development is a family-run, veteran-owned concrete contractor in San Diego County. Meet the team and see why neighbors keep hiring us.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_ORIGIN}/about-us` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_ORIGIN}/about-us`,
    siteName: "Rose Concrete",
    images: [
      { url: `${SITE_ORIGIN}/og-default.png`, width: 1200, height: 630 },
    ],
  },
};

export default function AboutPage() {
  const schema = jsonLdGraph([
    localBusinessJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", href: "/" },
      { name: "About", href: "/about-us" },
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
            <Link href="/" className="hover:text-accent-600">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-brand-800" aria-current="page">
            About
          </li>
        </ol>
      </nav>

      {/* Hero — minimal: H1 only. */}
      <section className="border-b border-brand-100 bg-cream-50">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
            About Us
          </h1>
        </div>
      </section>

      {/* Photo + body */}
      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 md:grid-cols-[2fr,3fr] md:items-center md:gap-12">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-brand-100 shadow-sm">
            <Image
              src="/images/rose-shirt-crew.jpg"
              alt="Thomas Rose with the Rose Concrete crew on a San Diego job site"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
              priority
            />
          </div>

          <div>
            <h2 className="text-3xl font-extrabold text-brand-900 sm:text-4xl">
              Built right. Built local.
            </h2>
            <p className="mt-5 text-base text-brand-700 sm:text-lg">
              At Rose Concrete and Development, we&rsquo;re passionate about
              building more than just strong, beautiful concrete projects —
              we&rsquo;re building lasting connections with our community. As
              a veteran-owned, family-run business, we&rsquo;ve made it our
              mission to serve our neighbors in San Diego with high-quality
              concrete work and the kind of personal attention you don&rsquo;t
              get from bigger outfits. Whether it&rsquo;s custom patios,
              driveways, sidewalks, or decorative concrete, my team and I are
              committed to delivering durable, beautiful results you can rely
              on. Thank you for trusting us to be part of your next project.
            </p>

            {/* Phone CTA */}
            <p className="mt-6 text-lg font-extrabold text-brand-900 sm:text-xl">
              Call us today:{" "}
              <a
                href={PHONE_TEL_HREF}
                className="text-accent-700 hover:text-accent-600"
              >
                {PHONE_DISPLAY}
              </a>
            </p>

            {/* Reviews badge */}
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-cream-50 px-3 py-1.5 text-sm font-semibold text-brand-800">
              <span aria-hidden="true" className="text-accent-600">
                ★★★★★
              </span>
              <a
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-accent-700"
              >
                140+ Google Reviews
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Partners strip — text-only fallback until partner logos land
          in /public/images/. Spec calls for: CSLB · SealBoss · Concrete
          Pumping · ICC. When the logos exist, swap each <span> for an
          <Image src="/images/partners/<slug>.png">. */}
      <section className="border-y border-brand-100 bg-cream-50/60 py-10">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-accent-700">
            Some of our partners
          </h2>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-brand-700">
            <span>CSLB</span>
            <span aria-hidden="true" className="text-brand-300">
              ·
            </span>
            <span>SealBoss Concrete Solutions</span>
            <span aria-hidden="true" className="text-brand-300">
              ·
            </span>
            <span>Raw Concrete Pumping</span>
            <span aria-hidden="true" className="text-brand-300">
              ·
            </span>
            <span>ICC</span>
          </p>
        </div>
      </section>

      <FinalCallCta />
    </>
  );
}
