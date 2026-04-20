import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { WatchList } from "./watch-list";
import { AddSenderForm } from "./add-form";
import { getGmailAdapter } from "@/lib/gmail";

export const metadata = { title: "Gmail watch — Rose Concrete" };

export default async function GmailWatchPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: senders } = await supabase
    .from("gmail_watched_senders")
    .select("id, email, label, note, is_active, created_at")
    .order("created_at", { ascending: false });
  const configured = getGmailAdapter().isConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gmail watched senders"
        subtitle="Emails from these addresses auto-attach to the matching sidewalk project. The gmail-permit-scan + email-auto-attach crons run every 15 min."
      />

      {configured ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
          <p className="font-semibold">✓ Gmail adapter configured</p>
          <p className="mt-1 text-xs">
            <code>GMAIL_CLIENT_ID</code> / <code>GMAIL_CLIENT_SECRET</code>
            / <code>GMAIL_REFRESH_TOKEN</code> are all set. The
            auto-attach cron can read the watched mailbox.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Gmail adapter not configured</p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">
            <li>
              Create an OAuth client in{" "}
              <a
                className="underline"
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud Console
              </a>
              . Enable the Gmail API. Add <code>gmail.readonly</code> scope.
            </li>
            <li>
              Set <code>GMAIL_CLIENT_ID</code> +{" "}
              <code>GMAIL_CLIENT_SECRET</code> in <code>.env.local</code>.
            </li>
            <li>
              Run <code>node scripts/gmail-oauth-bootstrap.js</code> and sign
              in as the mailbox owner; copy the printed{" "}
              <code>GMAIL_REFRESH_TOKEN</code> into <code>.env.local</code>.
            </li>
            <li>Restart the app.</li>
          </ol>
        </div>
      )}

      <Card>
        <p className="mb-2 text-xs text-neutral-500">
          Add the City of San Diego survey routing address, permit desk, and
          anyone else whose attachments should land on the sidewalk project
          automatically.
        </p>
        <AddSenderForm />
      </Card>
      <WatchList senders={senders ?? []} />
    </div>
  );
}
