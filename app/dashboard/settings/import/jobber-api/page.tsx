import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui";
import { CredentialsForm } from "./credentials-form";
import { ImportRunner } from "./import-runner";
import { disconnectJobberAction } from "./actions";

export const metadata = { title: "Jobber API import — Rose Concrete" };

type SearchParams = Promise<{ connected?: string; error?: string }>;

const CALLBACK_PATH = "/dashboard/settings/import/jobber-api/callback";

/**
 * Jobber GraphQL API importer home page.
 *
 * Three states, driven off the singleton `jobber_oauth_tokens` row:
 *   - No row           → show credentials form (step 1).
 *   - Row with pending_state and no access_token → mid-OAuth; tell user
 *     to finish authorizing.
 *   - Row with access_token → show the import runner + counters.
 */
export default async function JobberApiImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin"]);
  const { connected, error } = await searchParams;

  const appBase =
    process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "https://app.example.com";
  const redirectUri = `${appBase}${CALLBACK_PATH}`;

  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("jobber_oauth_tokens")
    .select(
      "id, account_name, access_token, refresh_token, access_expires_at, pending_state, import_cursor, clients_processed, notes_imported, attachments_imported, import_started_at, import_finished_at, last_error, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const connectedAndReady =
    row?.access_token && row.refresh_token && !row.pending_state;
  const midFlow = row?.pending_state && !row.access_token;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobber API import"
        subtitle="Pull client notes and photo attachments straight from Jobber via the GraphQL API. OAuth 2.0 authorization code flow."
        actions={
          <Link
            href="/dashboard/settings/import"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ← CSV imports
          </Link>
        }
      />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {connected && (
        <p className="rounded-md bg-accent-50 px-3 py-2 text-sm text-brand-700">
          ✓ Connected to Jobber. Click <strong>Start import</strong> below.
        </p>
      )}

      {/* Step 1: not connected */}
      {!row && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-brand-700">
            1 · Connect your Jobber app
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Create an app in the Jobber Developer Center, paste the Client
            ID and Client Secret, and set the redirect URI below.
          </p>
          <div className="mt-4">
            <CredentialsForm redirectUri={redirectUri} />
          </div>
        </section>
      )}

      {/* Credentials saved but user hasn't finished authorizing */}
      {midFlow && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Authorization in progress.</p>
          <p className="mt-1">
            We sent you to Jobber to authorize the app but haven&apos;t
            received a callback yet. If you closed the tab or denied the
            request, start over:
          </p>
          <form action={disconnectJobberAction} className="mt-3">
            <button
              type="submit"
              className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Reset and re-enter credentials
            </button>
          </form>
        </section>
      )}

      {/* Step 2: connected, ready to import */}
      {connectedAndReady && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-brand-700">
                2 · Run the import
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Pulls all clients from Jobber, matches by client name
                against the app DB, and imports each client&apos;s notes
                (up to 50 per client) and photo attachments. Re-run any
                time — dedupe is by Jobber&apos;s node id.
              </p>
            </div>
            <form action={disconnectJobberAction}>
              <button
                type="submit"
                className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Disconnect
              </button>
            </form>
          </div>

          <div className="mt-4">
            <ImportRunner
              initial={{
                clients_processed: row.clients_processed ?? 0,
                notes_imported: row.notes_imported ?? 0,
                attachments_imported: row.attachments_imported ?? 0,
                started_at: row.import_started_at,
                finished_at: row.import_finished_at,
                last_error: row.last_error,
                has_pending_cursor: Boolean(row.import_cursor),
              }}
            />
          </div>
        </section>
      )}

      <section className="rounded-md border border-accent-200 bg-accent-50 p-4 text-sm text-brand-800">
        <p className="font-semibold text-brand-700">Before you start</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Import the <strong>clients CSV</strong> first on the main
            import page. The API importer matches clients by name — if an
            entry isn&apos;t in our DB yet, it&apos;s skipped.
          </li>
          <li>
            In the Jobber Developer Center, under your app&apos;s
            settings, add the redirect URI shown in the form above.
          </li>
          <li>
            Scopes needed: read on clients, notes, note attachments.
          </li>
          <li>
            Access tokens expire every ~60 minutes; the app auto-refreshes
            using the stored refresh token, so leave the tab open and
            Ronnie can keep working.
          </li>
          <li>
            Photos are stored in Supabase Storage (private) and attached
            to the matching client. They show up in the attachments
            panel on the client detail page.
          </li>
        </ul>
      </section>
    </div>
  );
}
