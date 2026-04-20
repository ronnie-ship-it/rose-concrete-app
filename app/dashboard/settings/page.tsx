import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getAllFeatureFlags, type FeatureFlagKey } from "@/lib/feature-flags";
import { PageHeader, Card, StatusPill } from "@/components/ui";

export const metadata = { title: "Settings — Rose Concrete" };

const MODULE_LINKS: Array<{
  href: string;
  title: string;
  flagKey?: FeatureFlagKey;
  description: string;
}> = [
  {
    href: "/dashboard/settings/business-profile",
    title: "Business profile",
    description:
      "Company name, logo, bio, phone, address, business hours. Shown on the client hub + receipts.",
  },
  {
    href: "/dashboard/settings/team",
    title: "Manage team",
    description:
      "Invite office staff and crew, change roles (admin / office / crew).",
  },
  {
    href: "/dashboard/settings/work",
    title: "Work settings",
    description:
      "Default visit duration, working hours, first day of week — anchors the schedule grid.",
  },
  {
    href: "/dashboard/settings/invoicing",
    title: "Invoicing & payments",
    flagKey: "payment_schedules",
    description:
      "Check vs credit-card options, processing fee, and check instructions shown on invoices.",
  },
  {
    href: "/dashboard/settings/qbo",
    title: "QuickBooks job costing",
    flagKey: "qbo_job_costing",
    description:
      "Import expense transactions from QBO and see live per-project margin.",
  },
  {
    href: "/dashboard/settings/qbo-payments",
    title: "QuickBooks Payments (auto-invoice)",
    flagKey: "qbo_auto_invoice",
    description:
      "Automatically create a QBO invoice with the locked total the moment a customer accepts a quote. Opens the Pay Now link for ACH + card.",
  },
  {
    href: "/dashboard/settings/receipts",
    title: "Payment receipts",
    flagKey: "qbo_receipt_auto_send",
    description:
      "Auto-email a thank-you + QBO receipt PDF when a milestone flips to paid.",
  },
  {
    href: "/dashboard/settings/import",
    title: "Jobber import",
    description:
      "Upload Jobber CSV exports (clients, jobs, invoices) and map them into this app.",
  },
  {
    href: "/dashboard/settings/import-review",
    title: "Import review queue",
    description:
      "Orphaned CSV rows — jobs that couldn't match a client, etc. Pick from suggested matches or reassign manually.",
  },
  {
    href: "/dashboard/settings/products",
    title: "Products & Services",
    description:
      "Full catalog of saved line items grouped by category, with unit price / cost / margin / tax flags. Jobber-parity view of the line-item library.",
  },
  {
    href: "/dashboard/settings/line-items",
    title: "Line-item library (quick edit)",
    description:
      "Flat list — faster for a one-line price tweak. Use Products & Services for the full catalog.",
  },
  {
    href: "/dashboard/settings/custom-fields",
    title: "Custom fields",
    description:
      "Add text / number / date / dropdown fields to clients, projects, and quotes. Ronnie's spec for per-job custom data.",
  },
  {
    href: "/dashboard/settings/reviews",
    title: "Google review requests",
    flagKey: "review_request_auto_send",
    description:
      "Three days after final payment, auto-ask the client for a Google review via email or SMS.",
  },
  {
    href: "/dashboard/settings/lead-webhook",
    title: "Lead-capture webhook",
    flagKey: "lead_webhook",
    description:
      "Accept form posts from your website (Duda, WordPress, Wix) — instant-response text + draft quote.",
  },
  {
    href: "/dashboard/settings/templates",
    title: "Email & SMS templates",
    description:
      "Editable copy for every automated message (quote sent, appointment reminder, review request, etc.) with merge tokens.",
  },
  {
    href: "/dashboard/settings/automations",
    title: "Automations",
    description:
      "Cadence + content for the quote follow-up and post-job follow-up crons. Set the Google review URL here.",
  },
  {
    href: "/dashboard/settings/tax",
    title: "Tax rates",
    description:
      "Tax rates applied to quotes and invoices. Add the default San Diego County rate here.",
  },
  {
    href: "/dashboard/settings/discount-codes",
    title: "Discount codes",
    description:
      "Percent-off or flat-amount discount codes Ronnie can drop on a quote.",
  },
  {
    href: "/dashboard/settings/job-forms",
    title: "Job forms & checklists",
    description:
      "Pre-pour inspection, safety, and completion checklists crews fill out on site.",
  },
  {
    href: "/dashboard/settings/gmail-watch",
    title: "Gmail auto-forward",
    description:
      "Watched email addresses — the gmail-permit-scan cron auto-attaches their attachments to the active sidewalk project.",
  },
  {
    href: "/dashboard/settings/notifications",
    title: "Push notifications",
    description:
      "Enable browser push so new leads, quote approvals, and crew check-ins reach you off-tab. Subscription is collected now; delivery turns on once VAPID keys are set.",
  },
  {
    href: "/dashboard/settings/integrations",
    title: "Integrations status",
    description:
      "One-glance view of which external services (Gmail, OpenPhone, Resend, Web Push, QBO, Anthropic) are wired vs missing env vars.",
  },
  {
    href: "/dashboard/settings/workspace",
    title: "Workspace",
    description:
      "Rename your workspace, view plan / trial status, and see the teammates who belong to this tenant.",
  },
];

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const flags = await getAllFeatureFlags();
  const flagMap = new Map(flags.map((f) => [f.key, f]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Admin-only. Modules are gated by feature flags so you can turn them on and off without a redeploy."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Modules
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {MODULE_LINKS.map((m) => {
            const flag = m.flagKey ? flagMap.get(m.flagKey) : null;
            const enabled = flag?.enabled ?? false;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-neutral-900">{m.title}</h3>
                  {m.flagKey && (
                    <StatusPill
                      status={enabled ? "enabled" : "disabled"}
                      tone={enabled ? "success" : "neutral"}
                    />
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-600">{m.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          All feature flags
        </h2>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Key</th>
                <th className="px-4 py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr
                  key={f.key}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-2 font-mono text-xs text-neutral-700">
                    {f.key}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill
                      status={f.enabled ? "on" : "off"}
                      tone={f.enabled ? "success" : "neutral"}
                    />
                  </td>
                </tr>
              ))}
              {flags.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-neutral-500">
                    Could not load feature flags.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-neutral-500">
          Flags are toggled by updating the <code>feature_flags</code> table in
          Supabase directly (admin UI coming later).
        </p>
      </section>
    </div>
  );
}
