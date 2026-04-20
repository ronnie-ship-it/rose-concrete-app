import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { getGmailAdapter } from "@/lib/gmail";
import { getOpenPhoneAdapter } from "@/lib/openphone";
import { getEmailAdapter } from "@/lib/email";
import { isPushConfigured } from "@/lib/push";

export const metadata = { title: "Integrations — Rose Concrete" };

/**
 * One-page status view so Ronnie can tell at a glance which external
 * integrations are wired. Each row renders green (configured) or
 * amber (missing env) with a short explainer. Doesn't test live
 * connectivity — just checks that the required env vars are present;
 * per-integration pages (Gmail watch, Notifications, etc.) still own
 * the "try a real call" buttons.
 */
type Status = { label: string; configured: boolean; detail: string; helpLink?: string };

export default async function IntegrationsPage() {
  await requireRole(["admin"]);

  const gmail = getGmailAdapter();
  const openphone = getOpenPhoneAdapter();
  const email = getEmailAdapter();
  const pushOn = isPushConfigured();

  const statuses: Status[] = [
    {
      label: "Gmail (inbox auto-attach)",
      configured: gmail.isConfigured(),
      detail: gmail.isConfigured()
        ? "OAuth credentials loaded. email-auto-attach + permit-scan crons can read the inbox."
        : "Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN.",
      helpLink: "/dashboard/settings/gmail-watch",
    },
    {
      label: "OpenPhone (SMS + MMS)",
      configured: Boolean(process.env.OPENPHONE_API_KEY),
      detail: process.env.OPENPHONE_API_KEY
        ? "API key set. Outbound SMS + inbound backfill + MMS auto-attach live."
        : "Missing OPENPHONE_API_KEY. Sends no-op gracefully.",
    },
    {
      label: "Resend (transactional email)",
      configured: email.isConfigured(),
      detail: email.isConfigured()
        ? "RESEND_API_KEY set. Quote send / hub login / customer-form delivery all live."
        : "Missing RESEND_API_KEY. Emails are skipped with a warning.",
    },
    {
      label: "Web Push (notifications)",
      configured: pushOn,
      detail: pushOn
        ? "VAPID keys loaded. Test delivery from Settings → Notifications."
        : "Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.",
      helpLink: "/dashboard/settings/notifications",
    },
    {
      label: "QuickBooks Online",
      configured: Boolean(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET),
      detail:
        process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET
          ? "OAuth client configured. Invoice + reconcile crons will run when a company id is connected."
          : "Missing QBO_CLIENT_ID / QBO_CLIENT_SECRET.",
      helpLink: "/dashboard/settings/qbo",
    },
    {
      label: "Anthropic (AI alt-text + drafts)",
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      detail: process.env.ANTHROPIC_API_KEY
        ? "API key set. Photo alt-text generation live."
        : "Missing ANTHROPIC_API_KEY — uploads still work with a fallback alt.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="External services this app talks to. Green = configured, amber = needs env vars."
      />
      <Card className="p-0">
        <ul className="divide-y divide-neutral-100 dark:divide-brand-700">
          {statuses.map((s) => (
            <li
              key={s.label}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      s.configured ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {s.label}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                  {s.detail}
                </p>
              </div>
              {s.helpLink && (
                <a
                  href={s.helpLink}
                  className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200"
                >
                  Configure →
                </a>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
