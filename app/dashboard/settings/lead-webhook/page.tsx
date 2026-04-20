import { requireRole } from "@/lib/auth";
import { getFeatureFlag } from "@/lib/feature-flags";
import { LeadWebhookForm } from "./form";

export const metadata = { title: "Lead webhook — Rose Concrete" };

export default async function LeadWebhookPage() {
  await requireRole(["admin"]);
  const flag = await getFeatureFlag("lead_webhook");
  const base = process.env.APP_BASE_URL ?? "https://app.sandiegoconcrete.ai";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Lead-capture webhook
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          POSTs from your website contact forms land here, create a client +
          draft quote, and drop a follow-up task on Ronnie&apos;s queue.
        </p>
      </div>

      <LeadWebhookForm initial={{ enabled: flag?.enabled ?? false }} />

      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm shadow-sm">
        <h2 className="font-semibold text-neutral-900">Wiring instructions</h2>
        <p className="mt-1 text-neutral-600">
          Configure your site (Duda / WordPress / Wix / custom) to POST JSON
          to:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-neutral-900 px-3 py-2 text-xs text-neutral-100">
{`${base}/api/public/lead
Headers:
  x-rose-secret: $LEAD_WEBHOOK_SECRET
Body:
  { "name": "Jane Doe", "phone": "619-555-1212",
    "email": "jane@example.com", "address": "123 Main St, San Diego",
    "service_type": "driveway", "message": "...",
    "source": "sandiegoconcrete.ai" }`}
        </pre>
        <p className="mt-4 text-neutral-600">
          Or drop this snippet into any page to get a pre-built form:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-neutral-900 px-3 py-2 text-xs text-neutral-100">
{`<script>
  window.ROSE_LEAD_API = "${base}";
  window.ROSE_LEAD_SECRET = "PASTE_SECRET_HERE"; // careful — this is client-exposed
</script>
<script src="${base}/embed/lead.js" async></script>
<div data-rose-lead-form></div>`}
        </pre>
        <p className="mt-2 text-xs text-neutral-500">
          Heads up: the embed exposes the secret to the browser, so treat it
          as &ldquo;low-trust, high-volume&rdquo; — rotate it if spam spikes.
          For a stricter setup, proxy posts through your server and keep the
          secret server-side.
        </p>
      </div>
    </div>
  );
}
