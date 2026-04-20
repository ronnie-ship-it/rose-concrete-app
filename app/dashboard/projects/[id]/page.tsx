import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { money, dateShort } from "@/lib/format";
import { feeConfigFromRow, type FeeConfig } from "@/lib/payments";
import { ProjectForm } from "../project-form";
import {
  updateProjectAction,
  deleteProjectAction,
  generateInvoiceForProjectAction,
} from "../actions";
import { DeleteProjectButton } from "./delete-button";
import { GenerateInvoiceButton } from "./generate-invoice-button";
import { BookingTextButton } from "./booking-text-button";
import { MilestonesSection, type MilestoneRow } from "./milestones-section";
import { NotesPanel } from "@/components/notes-panel";
import { loadNotes } from "@/lib/notes-server";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { loadAttachments } from "@/lib/attachments";
import { CustomFieldsPanel } from "@/components/custom-fields/panel";
import { loadCustomFieldsFor } from "@/lib/custom-fields";
import { Clickable } from "@/components/clickable";
import { WorkflowSteps } from "./workflow-steps";
import type { ProjectWorkflowStep } from "@/lib/workflows";
import { PhotosPanel } from "./photos-panel";
import type { ProjectMedia } from "@/lib/project-media/types";
import { BillingTabs } from "./billing-tabs";
import { RemindersPane, type MilestoneReminders } from "./reminders-pane";
import { InvoiceSidebar } from "./invoice-sidebar";
import { loadProjectProfitability } from "@/lib/project-profitability";
import { ProfitabilityDonut } from "@/components/profitability-donut";
import { SignaturesPanel, type SignatureRow } from "./signatures-panel";
import { PhaseTimeline } from "./phase-timeline";
import type { PhaseRow } from "@/lib/phases";
import { CustomerFormsPanel, type CustomerFormSummary } from "./customer-forms-panel";
import { PhotoComplianceStrip } from "./photo-compliance-strip";
import { headers } from "next/headers";

export const metadata = { title: "Project — Rose Concrete" };

type Params = Promise<{ id: string }>;

export default async function ProjectDetailPage({ params }: { params: Params }) {
  await requireRole(["admin", "office"]);
  const { id } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, client:clients(id, name)")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  const updateAction = updateProjectAction.bind(null, id);
  const deleteAction = deleteProjectAction.bind(null, id);
  const clientRel = Array.isArray(project.client)
    ? project.client[0]
    : project.client;

  // Payment schedule + milestones (BACKLOG #1). Project may not have one
  // yet (e.g. still a lead) — section just hides if the schedule row is
  // absent. Gated by the payment_schedules flag.
  const paymentsEnabled = await isFeatureEnabled("payment_schedules");
  const { data: schedule } = paymentsEnabled
    ? await supabase
        .from("payment_schedules")
        .select(
          "id, qbo_invoice_id, qbo_invoice_number, allow_card, allow_ach, allow_partial, show_quantities, show_unit_price, show_line_totals, show_account_balance, show_late_stamp, require_signature, sent_at, sent_channel, milestones:payment_milestones(id, sequence, kind, label, amount, due_date, status, payment_method, fee_amount, total_with_fee, pay_token, qbo_payment_id, qbo_paid_at, reminders_paused)"
        )
        .eq("project_id", id)
        .maybeSingle()
    : { data: null };

  // Reminders for every milestone — fed to the Reminders tab.
  const milestoneIds: string[] = (schedule?.milestones ?? []).map(
    (m) => m.id as string,
  );
  const { data: reminderRows } =
    paymentsEnabled && milestoneIds.length > 0
      ? await supabase
          .from("payment_reminders")
          .select(
            "id, milestone_id, channel, offset_days, scheduled_for, status, sent_at, error",
          )
          .in("milestone_id", milestoneIds)
          .order("scheduled_for", { ascending: true })
      : { data: [] as Array<Record<string, unknown>> };

  const { data: invoiceSettings } = paymentsEnabled
    ? await supabase
        .from("invoice_settings")
        .select(
          "cc_fee_percent, cc_fee_flat_cents, cc_fee_absorb, ach_fee_percent, ach_fee_flat_cents, ach_fee_absorb",
        )
        .limit(1)
        .maybeSingle()
    : { data: null };

  const feeConfig: FeeConfig = feeConfigFromRow(invoiceSettings);

  const milestoneRows: MilestoneRow[] = (schedule?.milestones ?? [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((m) => ({
      id: m.id as string,
      sequence: m.sequence as number,
      kind: m.kind as MilestoneRow["kind"],
      label: m.label as string,
      amount: Number(m.amount),
      due_date: (m.due_date as string | null) ?? null,
      status: m.status as string,
      payment_method: (m.payment_method as MilestoneRow["payment_method"]) ?? null,
      fee_amount: Number(m.fee_amount ?? 0),
      total_with_fee:
        m.total_with_fee == null ? null : Number(m.total_with_fee),
      pay_token: m.pay_token as string,
      qbo_payment_id: (m.qbo_payment_id as string | null) ?? null,
      qbo_paid_at: (m.qbo_paid_at as string | null) ?? null,
      reminders_paused: !!m.reminders_paused,
    }));

  // Captured signatures for this schedule + every milestone underneath
  // it — Jobber's "Signed by" audit. Renders below the InvoiceSidebar
  // when any exist. We pull both scopes so the panel shows schedule-
  // level (quote accept) and milestone-level (per-payment) rows
  // together, labeled by which they belong to.
  const sigEntityIds: string[] = schedule?.id
    ? [schedule.id as string, ...milestoneIds]
    : [];
  const { data: signatures } = sigEntityIds.length > 0
    ? await supabase
        .from("signatures")
        .select(
          "id, entity_type, entity_id, signer_name, png_data_url, captured_at, captured_ip",
        )
        .in("entity_type", ["payment_schedule", "payment_milestone"])
        .in("entity_id", sigEntityIds)
        .order("captured_at", { ascending: false })
        .limit(20)
    : { data: [] as Array<Record<string, unknown>> };

  // Map milestone id → label so the SignaturesPanel can render a
  // "Milestone #1 · 50% deposit" badge on each row.
  const milestoneLabelById = new Map<string, string>(
    milestoneRows.map((m) => [m.id, `#${m.sequence} · ${m.label}`]),
  );

  // Group reminders under their milestone for the Reminders tab.
  const reminderGroups: MilestoneReminders[] = milestoneRows.map((m) => ({
    milestoneId: m.id,
    milestoneLabel: m.label,
    dueDate: m.due_date,
    remindersPaused: m.reminders_paused,
    reminders: (reminderRows ?? [])
      .filter((r) => r.milestone_id === m.id)
      .map((r) => ({
        id: r.id as string,
        milestone_id: r.milestone_id as string,
        channel: r.channel as "email" | "sms",
        offset_days: Number(r.offset_days ?? 0),
        scheduled_for: r.scheduled_for as string,
        status: r.status as "scheduled" | "sent" | "failed" | "skipped",
        sent_at: (r.sent_at as string | null) ?? null,
        error: (r.error as string | null) ?? null,
      })),
  }));

  // Profitability breakdown for the donut widget. Always runs — if there
  // are no costs yet the donut renders the revenue ring with a single
  // "Profit = Revenue" slice, which is the right thing to show.
  const profitability = await loadProjectProfitability(id);

  // Phases (migration 038) — auto-seed in read isn't ideal (it mutates
  // on GET), so we just pull what's there and let the <PhaseTimeline>
  // show a "Create default phases" button when the list is empty.
  const { data: phaseRowsRaw } = await supabase
    .from("project_phases")
    .select("*")
    .eq("project_id", id)
    .order("sequence", { ascending: true });
  const phaseRows = (phaseRowsRaw ?? []) as PhaseRow[];

  // Customer forms — demo_ack / pre_pour / completion.
  const { data: customerFormsRaw } = await supabase
    .from("customer_forms")
    .select(
      "id, kind, status, token, sent_at, sent_via, completed_at",
    )
    .eq("project_id", id);
  const customerForms: CustomerFormSummary[] = (customerFormsRaw ?? []).map(
    (r) => ({
      id: r.id as string,
      kind: r.kind as CustomerFormSummary["kind"],
      status: r.status as CustomerFormSummary["status"],
      token: r.token as string,
      sent_at: (r.sent_at as string | null) ?? null,
      sent_via: (r.sent_via as string | null) ?? null,
      completed_at: (r.completed_at as string | null) ?? null,
    }),
  );

  // Crew photo reminders — today's compliance grid.
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: todaysReminders } = await supabase
    .from("crew_photo_reminders")
    .select("user_id, uploads_at_send, sent_at, user:profiles(full_name)")
    .eq("project_id", id)
    .gte("sent_at", `${todayIso}T00:00:00Z`)
    .order("sent_at", { ascending: false });

  // Origin for copy-link in <CustomerFormsPanel>.
  const h = await headers();
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "");

  // Phase 2 — QBO job costing. Only load costs if the feature flag is on; this
  // keeps the project page fast when the module is disabled.
  const jobCostingEnabled = await isFeatureEnabled("qbo_job_costing");
  const { data: costs } = jobCostingEnabled
    ? await supabase
        .from("job_costs")
        .select("id, amount, occurred_on, category, memo, raw_customer, match_source")
        .eq("project_id", id)
        .order("occurred_on", { ascending: false })
    : { data: null };

  const notes = await loadNotes("project", id);
  const attachments = await loadAttachments("project", id);

  // Project media (photo library) — newest first.
  const { data: photosRaw } = await supabase
    .from("project_media")
    .select("*")
    .eq("project_id", id)
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const photos = (photosRaw ?? []) as ProjectMedia[];
  const customFields = await loadCustomFieldsFor("project", id);

  const [{ data: workflowSteps }, { data: teamProfiles }] = await Promise.all([
    supabase
      .from("project_workflow_steps")
      .select("*")
      .eq("project_id", id)
      .order("sequence", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "office", "crew"])
      .order("full_name"),
  ]);

  // Quotes and visits attached to this project — surfaced inline so the
  // project page is the single pane of glass per Jobber-parity directive.
  const [{ data: projQuotes }, { data: projVisits }] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, number, status, base_total, accepted_total, issued_at")
      .eq("project_id", id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("visits")
      .select("id, scheduled_for, duration_min, status, is_placeholder, notes")
      .eq("project_id", id)
      .order("scheduled_for", { ascending: false })
      .limit(20),
  ]);

  const revenueCached = Number(project.revenue_cached ?? 0);
  const costCached = Number(project.cost_cached ?? 0);
  const marginCached = Number(project.margin_cached ?? 0);
  const marginPct =
    revenueCached > 0 ? (marginCached / revenueCached) * 100 : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/projects"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Projects
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              {project.name}
            </h1>
            {clientRel && (
              <p className="text-sm text-neutral-600">
                Client:{" "}
                <Link
                  href={`/dashboard/clients/${clientRel.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {clientRel.name}
                </Link>
              </p>
            )}
          </div>
          <DeleteProjectButton action={deleteAction} name={project.name} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold uppercase tracking-wide text-brand-700">
            {project.status}
          </span>
          <Link
            href={`/dashboard/quotes/new?project_id=${id}`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            + Quote
          </Link>
          <Link
            href={`/dashboard/schedule/new?project_id=${id}`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            + Visit
          </Link>
          {clientRel && (
            <Link
              href={`/dashboard/clients/${clientRel.id}`}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              View client
            </Link>
          )}
          {paymentsEnabled &&
            schedule &&
            !schedule.qbo_invoice_id &&
            milestoneRows.length > 0 && (
              <GenerateInvoiceButton
                action={generateInvoiceForProjectAction.bind(null, id)}
                projectName={project.name}
              />
            )}
          {paymentsEnabled && schedule?.qbo_invoice_number && (
            <span className="rounded-full bg-green-100 px-2.5 py-1 font-semibold text-green-800">
              📄 Invoiced · {schedule.qbo_invoice_number}
            </span>
          )}
          <BookingTextButton projectId={id} />
          {paymentsEnabled && schedule && (
            <Link
              href={`/dashboard/projects/${id}/invoice-pdf`}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
              target="_blank"
            >
              📄 Invoice PDF
            </Link>
          )}
        </div>
      </div>

      {project.location && (
        <div className="text-sm">
          <Clickable kind="map" value={project.location}>
            {project.location}
          </Clickable>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Edit
        </h2>
        <ProjectForm
          action={updateAction}
          clients={clients ?? []}
          initial={project}
        />
      </div>

      {workflowSteps && workflowSteps.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Workflow · {project.service_type ?? ""}
            </h2>
            <span className="text-xs text-neutral-500">
              {
                workflowSteps.filter((s) => s.status === "done").length
              }{" "}
              / {workflowSteps.length} done
            </span>
          </div>
          <WorkflowSteps
            projectId={id}
            steps={workflowSteps as unknown as ProjectWorkflowStep[]}
            profiles={(teamProfiles ?? []) as { id: string; full_name: string | null }[]}
          />
        </div>
      )}

      {customFields.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Custom fields
          </h2>
          <CustomFieldsPanel
            entityType="project"
            entityId={id}
            rows={customFields}
          />
        </div>
      )}

      {/* Project media — Finals (curated, public) + Job Photos (internal).
          Photos in Finals flow automatically to the marketing site via
          lib/marketing/project-photos.ts queries. Crew uploads land in
          Job Photos and require admin/office to "Send to Finals" before
          they go live on the website. */}
      <PhotosPanel projectId={id} initial={photos} role="admin" />

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Notes
        </h2>
        <NotesPanel entityType="project" entityId={id} notes={notes} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <AttachmentsPanel
          entityType="project"
          entityId={id}
          attachments={attachments}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Quotes
            </h2>
            <Link
              href={`/dashboard/quotes/new?project_id=${id}`}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              + New
            </Link>
          </div>
          {projQuotes && projQuotes.length > 0 ? (
            <ul className="divide-y divide-neutral-100 text-sm">
              {projQuotes.map((q) => {
                const total =
                  q.accepted_total != null
                    ? Number(q.accepted_total)
                    : Number(q.base_total ?? 0);
                return (
                  <li key={q.id} className="px-5 py-3">
                    <Link
                      href={`/dashboard/quotes/${q.id}`}
                      className="flex items-center justify-between hover:bg-neutral-50 -mx-5 px-5"
                    >
                      <div>
                        <div className="font-mono text-sm font-semibold text-brand-700">
                          {q.number}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {dateShort(q.issued_at)} · {q.status}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {money(total)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-neutral-500">
              No quotes yet.{" "}
              <Link
                href={`/dashboard/quotes/new?project_id=${id}`}
                className="text-brand-700 hover:underline"
              >
                Create the first one.
              </Link>
            </p>
          )}
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Visits
            </h2>
            <Link
              href={`/dashboard/schedule/new?project_id=${id}`}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              + Schedule
            </Link>
          </div>
          {projVisits && projVisits.length > 0 ? (
            <ul className="divide-y divide-neutral-100 text-sm">
              {projVisits.map((v) => (
                <li key={v.id} className="px-5 py-3">
                  <Link
                    href={`/dashboard/schedule/${v.id}`}
                    className="-mx-5 flex items-center justify-between gap-2 px-5 hover:bg-neutral-50"
                  >
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {new Date(v.scheduled_for).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {v.duration_min} min
                        {v.is_placeholder ? " · placeholder" : ""}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        v.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : v.status === "cancelled"
                            ? "bg-neutral-100 text-neutral-600"
                            : v.status === "in_progress"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      {v.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-neutral-500">
              No visits scheduled yet.
            </p>
          )}
        </section>
      </div>

      {/* Phase timeline — demo → prep → pour → cleanup → inspection. */}
      <PhaseTimeline projectId={id} phases={phaseRows} />

      {/* Customer forms — pre-demo ack, pre-pour, completion. */}
      <CustomerFormsPanel
        projectId={id}
        forms={customerForms}
        demoAckRequired={project.demo_ack_required !== false}
        demoAckAt={(project.demo_ack_at as string | null) ?? null}
        origin={origin}
      />

      {/* Daily photo-upload compliance strip — rendered when today has
          at least one reminder fire. */}
      {todaysReminders && todaysReminders.length > 0 && (
        <PhotoComplianceStrip
          rows={todaysReminders.map((r) => ({
            user_id: r.user_id as string,
            full_name:
              (Array.isArray(r.user)
                ? r.user[0]?.full_name
                : (r.user as { full_name: string | null } | null)?.full_name) ??
              null,
            uploads_at_send: Number(r.uploads_at_send ?? 0),
            sent_at: r.sent_at as string,
          }))}
        />
      )}

      {/* Job Profitability donut — always visible (no feature flag) so
          Ronnie sees margin at a glance even for projects that aren't
          fully QBO-wired yet. */}
      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Job profitability
          </h2>
          {profitability.costRowCount > 0 && (
            <span className="text-xs text-neutral-500">
              {profitability.costRowCount} cost{" "}
              {profitability.costRowCount === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>
        <ProfitabilityDonut data={profitability} />
      </section>

      {paymentsEnabled && signatures && signatures.length > 0 && (
        <SignaturesPanel
          signatures={signatures as unknown as SignatureRow[]}
          milestoneLabelById={milestoneLabelById}
        />
      )}

      {/* #billing anchor so +Invoice/+Payment deep-links from the
          client page scroll straight to the billing tabs. */}
      <span id="billing" aria-hidden="true" />

      {paymentsEnabled && milestoneRows.length === 0 && (
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Billing
          </h2>
          <p className="mt-2">
            No payment schedule on this project yet. Accept a quote or
            generate an invoice from one of the project&apos;s quotes to
            start billing.
          </p>
          {projQuotes && projQuotes.length > 0 && (
            <div className="mt-3">
              <GenerateInvoiceButton
                action={generateInvoiceForProjectAction.bind(null, id)}
                projectName={project.name}
              />
            </div>
          )}
        </section>
      )}

      {paymentsEnabled && milestoneRows.length > 0 && schedule && (
        <BillingTabs
          invoicing={
            <MilestonesSection
              projectId={id}
              milestones={milestoneRows}
              feeConfig={feeConfig}
              scheduleQboInvoiceId={
                (schedule.qbo_invoice_id as string | null) ?? null
              }
              scheduleQboInvoiceNumber={
                (schedule.qbo_invoice_number as string | null) ?? null
              }
            />
          }
          reminders={<RemindersPane groups={reminderGroups} />}
          sidebar={
            <InvoiceSidebar
              projectId={id}
              initial={{
                allow_card: schedule.allow_card !== false,
                allow_ach: schedule.allow_ach !== false,
                allow_partial: schedule.allow_partial === true,
                show_quantities: schedule.show_quantities !== false,
                show_unit_price: schedule.show_unit_price !== false,
                show_line_totals: schedule.show_line_totals !== false,
                show_account_balance: schedule.show_account_balance !== false,
                show_late_stamp: schedule.show_late_stamp !== false,
                require_signature: schedule.require_signature === true,
                sent_at: (schedule.sent_at as string | null) ?? null,
                sent_channel:
                  (schedule.sent_channel as string | null) ?? null,
              }}
            />
          }
        />
      )}

      {jobCostingEnabled ? (
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Job profitability
            </h2>
            <Link
              href="/dashboard/settings/qbo"
              className="text-xs text-neutral-500 hover:underline"
            >
              QBO import →
            </Link>
          </div>
          <div className="grid gap-4 px-6 py-4 md:grid-cols-4">
            <MarginStat label="Revenue" value={money(revenueCached)} />
            <MarginStat label="Cost" value={money(costCached)} />
            <MarginStat
              label="Margin"
              value={money(marginCached)}
              emphasis={
                marginCached < 0
                  ? "bad"
                  : marginCached > 0
                    ? "good"
                    : undefined
              }
            />
            <MarginStat
              label="Margin %"
              value={marginPct === null ? "—" : `${marginPct.toFixed(1)}%`}
              emphasis={
                marginPct === null
                  ? undefined
                  : marginPct < 15
                    ? "bad"
                    : marginPct >= 30
                      ? "good"
                      : undefined
              }
            />
          </div>
          <div className="border-t border-neutral-100">
            {costs && costs.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-6 py-2">Date</th>
                    <th className="px-6 py-2">Category</th>
                    <th className="px-6 py-2">Memo</th>
                    <th className="px-6 py-2">QBO name</th>
                    <th className="px-6 py-2">Source</th>
                    <th className="px-6 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c) => (
                    <tr
                      key={c.id as string}
                      className="border-t border-neutral-100"
                    >
                      <td className="px-6 py-2 text-neutral-700">
                        {dateShort(c.occurred_on as string)}
                      </td>
                      <td className="px-6 py-2 text-neutral-600">
                        {(c.category as string | null) ?? "—"}
                      </td>
                      <td className="px-6 py-2 text-xs text-neutral-500">
                        {(c.memo as string | null) ?? ""}
                      </td>
                      <td className="px-6 py-2 text-xs text-neutral-500">
                        {(c.raw_customer as string | null) ?? ""}
                      </td>
                      <td className="px-6 py-2 text-xs">
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                          {c.match_source as string}
                        </span>
                      </td>
                      <td className="px-6 py-2 text-right font-medium text-neutral-900">
                        {money(c.amount as number)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-6 text-center text-sm text-neutral-500">
                No costs recorded for this project yet.
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500">
          Quotes, scheduled visits, and job-cost margin land here in the next
          Phase 1 steps.
        </div>
      )}
    </div>
  );
}

function MarginStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "good" | "bad";
}) {
  const color =
    emphasis === "good"
      ? "text-green-700"
      : emphasis === "bad"
        ? "text-red-700"
        : "text-neutral-900";
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
