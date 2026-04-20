import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";
import {
  importClientsAction,
  importProjectsAction,
  importQuotesAction,
  importVisitsAction,
  importLineItemsAction,
  importContactsAction,
  importClientCommunicationsAction,
  importRequestsAction,
  importFeedbackAction,
} from "./actions";

export const metadata = { title: "Jobber import — Rose Concrete" };

/**
 * Jobber CSV import, built to the spec Thomas handed over on 2026-04-14.
 *
 * Core five (in order — each depends on what came before):
 *   1. Clients
 *   2. Jobs → projects            (needs clients)
 *   3. Quotes                     (needs projects)
 *   4. Visits                     (needs projects, optionally crew profiles)
 *   5. Products and Services      (line-item library, independent)
 *
 * Extra Jobber exports (run any time after Clients / Jobs):
 *   6. Client Contact Info        → client_contacts    (needs clients)
 *   7. Client Communications      → communications     (needs clients)
 *   8. Requests Report            → leads
 *   9. Feedback                   → client_feedback    (needs clients)
 *
 * Drag-and-drop → preview (5-row sample + row errors) → commit. Dedupe is
 * "skip on existing" across the board per spec.
 */

export default async function ImportPage() {
  await requireRole(["admin"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobber import"
        subtitle="Drag each CSV onto its tile, preview the mapped rows, and click Import. Run them in order — each step depends on the ones before it. Existing rows are skipped so re-running a file is safe."
        actions={
          <Link
            href="/dashboard/settings/import/jobber-api"
            className="inline-flex items-center justify-center rounded-md border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
          >
            Pull notes + photos via Jobber API →
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <ImportForm
          kind="clients"
          label="1 · Clients"
          commitAction={importClientsAction}
          description="Jobber → Clients → Export. Columns used: Client name, Phone, Email, Billing address, Lead source, Created date, Tags. Dedupe: skip when client name already exists."
        />
        <ImportForm
          kind="jobs"
          label="2 · Jobs → Projects"
          commitAction={importProjectsAction}
          description="Columns used: Job #, Client name, Title, Created date, Scheduled start date, Closed date, Total revenue, Service street/city/ZIP. Dedupe: Job # (preferred) or (client, title)."
        />
        <ImportForm
          kind="quotes"
          label="3 · Quotes"
          commitAction={importQuotesAction}
          description="Columns used: Quote #, Client name, Title, Status, Total ($), Required deposit, Approved date, Drafted date. Attached to the most recent project for that client. Dedupe: Quote #."
        />
        <ImportForm
          kind="visits"
          label="4 · Visits"
          commitAction={importVisitsAction}
          description="Columns used: Job #, Date, Times, Assigned to, Visit completed date. Export ALL visits (all-time date range, not just upcoming) so job history carries over. Past visits with a completion date come in as 'completed'. Looks up the project by Job # — import jobs first. Dedupe: (project, scheduled time)."
        />
        <ImportForm
          kind="products"
          label="5 · Products and Services"
          commitAction={importLineItemsAction}
          description="Feeds the line-item library. Columns used: Name, Invoiced $. Dedupe: title (case-insensitive)."
        />
        <ImportForm
          kind="contacts"
          label="6 · Client Contact Info"
          commitAction={importContactsAction}
          description="Secondary contacts per client (spouse, billing contact, property manager). Columns used: Client name, Contact type, First/Last name, Email, Phone, Notes. Needs clients imported first. Dedupe: (client, email) or (client, phone)."
        />
        <ImportForm
          kind="communications"
          label="7 · Client Communications"
          commitAction={importClientCommunicationsAction}
          description="Email history from Jobber. Columns used: Client name, Direction, Subject, Body/Preview, Date, Email address, Thread ID. Writes to the communications feed (channel=email). Needs clients imported first. Dedupe: external id, else (client, subject, timestamp)."
        />
        <ImportForm
          kind="requests"
          label="8 · Requests Report"
          commitAction={importRequestsAction}
          description="Incoming work requests / leads. Columns used: Request #, Client name, Title, Contact name/phone/email, Service address, Service type, Message, Status, Requested date, Price. Writes to the leads queue. Dedupe: Request # (preferred) else (client, title, date)."
        />
        <ImportForm
          kind="feedback"
          label="9 · Customer Feedback"
          commitAction={importFeedbackAction}
          description="Satisfaction scores, NPS, reviews. Columns used: Client name, Job # (optional), Score/Rating/NPS, Comment, Date. Scores 1-5 inferred as rating, 0-10 as NPS. Dedupe: feedback id (preferred) else (client, date)."
        />
      </div>

      <div className="rounded-md border border-accent-200 bg-accent-50 p-4 text-sm text-brand-800">
        <p className="font-semibold text-brand-700">Import order matters</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Clients first — everything else keys off client name.</li>
          <li>
            Jobs second — the Job # is the anchor visits use to find their
            project.
          </li>
          <li>
            Quotes third — attached to the most recent project for each
            client (Jobber&apos;s quote export doesn&apos;t carry Job #).
          </li>
          <li>Visits fourth — needs jobs (for Job #) and optionally crew profiles.</li>
          <li>Products can run any time — independent of the others.</li>
          <li>
            Contact info, communications, and feedback all key off clients,
            so run them after step 1.
          </li>
          <li>Requests (leads) can run any time — client link is optional.</li>
          <li>
            When exporting from Jobber, set the date range to{" "}
            <strong>All time</strong> (not just the default 30 days) so past
            visits, emails, and requests come across. Re-running the same
            file is a safe no-op because dedupe is skip-on-existing.
          </li>
          <li>Each file must be under 10 MB.</li>
        </ul>
      </div>
    </div>
  );
}
