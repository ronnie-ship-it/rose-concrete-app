import { requireRole } from "@/lib/auth";
import { getFeatureFlag } from "@/lib/feature-flags";
import { GOOGLE_REVIEW_URL } from "@/lib/marketing/brand";
import { ReviewSettingsForm } from "./form";

export const metadata = { title: "Review requests — Rose Concrete" };

export default async function ReviewsSettingsPage() {
  await requireRole(["admin"]);
  const flag = await getFeatureFlag("review_request_auto_send");
  const config = (flag?.config ?? {}) as {
    google_review_url?: string;
    channel?: "email" | "sms";
  };

  // Default to the brand-constant URL when the settings row is unset —
  // admins see the canonical link in the form rather than an empty box,
  // so saving without editing still produces a working config.
  const reviewUrl = (config.google_review_url ?? "").trim() || GOOGLE_REVIEW_URL;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Google review requests
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Three days after a milestone flips to paid, Ronnie&apos;s dashboard
          auto-asks for a Google review. Cron{" "}
          <code>/api/cron/review-requests</code> runs daily.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Default URL is the canonical{" "}
          <code className="font-mono">GOOGLE_REVIEW_URL</code> from{" "}
          <code>lib/marketing/brand.ts</code> (sourced from the GBP &ldquo;Get
          more reviews&rdquo; panel). Override here if you want to test a
          tracking-parameter variant.
        </p>
      </div>
      <ReviewSettingsForm
        initial={{
          enabled: flag?.enabled ?? false,
          google_review_url: reviewUrl,
          channel: config.channel ?? "email",
        }}
      />
    </div>
  );
}
