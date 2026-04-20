"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";
import { seedDefaultScheduleFromQuote } from "@/lib/payment-schedules";
import { seedStepsForProject } from "@/lib/workflows";
import { getQboInvoiceAdapter } from "@/lib/qbo/invoices";
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";
import { PROJECT_STATUSES } from "./constants";

const ProjectSchema = z.object({
  client_id: z.string().uuid("Pick a client"),
  name: z.string().trim().min(1, "Name is required").max(200),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  status: z.enum(PROJECT_STATUSES),
  sqft: z.coerce.number().nonnegative().optional().or(z.literal("")),
  cubic_yards: z.coerce.number().nonnegative().optional().or(z.literal("")),
  measurement_source: z.string().trim().max(40).optional().or(z.literal("")),
  measurement_notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ProjectFormState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return ProjectSchema.safeParse(raw);
}

function clean(input: z.infer<typeof ProjectSchema>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of [
    "location",
    "measurement_source",
    "measurement_notes",
  ] as const) {
    if (out[k] === "") out[k] = null;
  }
  for (const k of ["sqft", "cubic_yards"] as const) {
    if (out[k] === "" || out[k] === undefined) out[k] = null;
  }
  return out;
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireRole(["admin", "office"]);
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join("."), i.message])
      ),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(clean(parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  // Auto-seed workflow steps if the project was created with a
  // service_type that has a template (sidewalk today, more later).
  try {
    await seedStepsForProject(data.id);
  } catch (err) {
    console.error("[createProject] workflow seed threw:", err);
  }
  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${data.id}`);
}

export async function updateProjectAction(
  id: string,
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  await requireRole(["admin", "office"]);
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors below.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join("."), i.message])
      ),
    };
  }
  const supabase = await createClient();

  // Capture prior status so we only seed a schedule on the actual transition
  // INTO 'approved' — not on every save of an already-approved project.
  const { data: prior } = await supabase
    .from("projects")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("projects")
    .update(clean(parsed.data))
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (prior?.status !== "approved" && parsed.data.status === "approved") {
    try {
      const seed = await seedDefaultScheduleFromQuote(id);
      if (!seed.ok) {
        console.error("[updateProject] schedule seed failed:", seed.error);
      }
    } catch (err) {
      console.error("[updateProject] schedule seed threw:", err);
    }
    // Also seed the demo→pour→cleanup phases on first approval so the
    // timeline is populated the moment Ronnie flips to approved.
    try {
      const { seedDefaultPhases } = await import("@/lib/phases");
      await seedDefaultPhases(id);
    } catch (err) {
      console.error("[updateProject] phase seed threw:", err);
    }
  }

  // Gate transitions INTO 'active' on a signed demo acknowledgment.
  if (
    prior?.status !== "active" &&
    parsed.data.status === "active"
  ) {
    const { data: proj } = await supabase
      .from("projects")
      .select("demo_ack_required, demo_ack_at")
      .eq("id", id)
      .maybeSingle();
    if (proj?.demo_ack_required && !proj.demo_ack_at) {
      // Revert the status — and fieldError so the form shows it.
      await supabase
        .from("projects")
        .update({ status: prior?.status ?? "scheduled" })
        .eq("id", id);
      return {
        ok: false,
        error:
          "Customer hasn't signed the pre-demo acknowledgment yet. Send the welcome form from the project page first.",
        fieldErrors: { status: "Demo acknowledgment required" },
      };
    }
  }

  // Seed workflow steps when a service_type is assigned (idempotent —
  // returns created:0 if steps already exist). Critical for Ronnie's
  // sidewalk-permit flow: tagging a project sidewalk = instant 11-step
  // checklist.
  try {
    await seedStepsForProject(id);
  } catch (err) {
    console.error("[updateProject] workflow seed threw:", err);
  }

  // Fire automations on state transitions.
  if (prior?.status !== parsed.data.status) {
    try {
      const { runAutomationsFor } = await import("@/lib/automations");
      const { data: proj } = await supabase
        .from("projects")
        .select(
          "id, name, service_type, service_address, client:clients(id, name, phone, email)",
        )
        .eq("id", id)
        .maybeSingle();
      type P = {
        id: string;
        name: string;
        service_type: string | null;
        service_address: string | null;
        client:
          | { id: string; name: string; phone: string | null; email: string | null }
          | { id: string; name: string; phone: string | null; email: string | null }[]
          | null;
      };
      const p = proj as P | null;
      const c = p?.client
        ? Array.isArray(p.client)
          ? p.client[0]
          : p.client
        : null;
      const payload = {
        project_id: id,
        client_id: c?.id ?? null,
        client_name: c?.name ?? null,
        client_phone: c?.phone ?? null,
        client_email: c?.email ?? null,
        project_name: p?.name ?? null,
        service_address: p?.service_address ?? null,
        service_type: p?.service_type ?? null,
      };
      if (parsed.data.status === "done") {
        await runAutomationsFor(
          {
            trigger: "job_completed",
            entity_type: "project",
            entity_id: id,
            payload,
          },
          supabase,
        );
      }
    } catch (err) {
      console.error("[updateProject] automations dispatcher threw:", err);
    }
  }

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  return { ok: true };
}

/**
 * Job → invoice one-click. Mirrors the quote → job flow: stamps the
 * project's payment_schedules row with a QBO invoice id/number, logs an
 * activity_log entry, and redirects back to the project page.
 *
 * The QBO adapter is a stub until real creds are wired — it returns a
 * MOCK-XXXX number so the UI still renders correctly end-to-end. When
 * the real adapter lands, swap in `getQboInvoiceAdapter` internals.
 *
 * Idempotent: if the schedule already has a qbo_invoice_id, we skip the
 * API call and return the existing values. That way Ronnie can hit the
 * button twice without creating duplicate invoices in QBO.
 */
export async function generateInvoiceForProjectAction(
  projectId: string
): Promise<void> {
  await requireRole(["admin", "office"]);
  const actor = await requireUser();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client:clients(name)")
    .eq("id", projectId)
    .single();
  if (!project) throw new Error("Project not found");

  const { data: schedule } = await supabase
    .from("payment_schedules")
    .select(
      "id, qbo_invoice_id, qbo_invoice_number, milestones:payment_milestones(id, label, amount, due_date, sequence, payment_method, fee_amount, total_with_fee)",
    )
    .eq("project_id", projectId)
    .maybeSingle();
  if (!schedule) {
    throw new Error(
      "No payment schedule on this project yet. Convert a quote to a job first."
    );
  }
  if (schedule.qbo_invoice_id) {
    // Already invoiced — just bounce back; the button is hidden in this
    // state anyway but defense in depth.
    redirect(`/dashboard/projects/${projectId}`);
  }

  const milestones = (schedule.milestones ?? [])
    .slice()
    .sort(
      (a: { sequence: number }, b: { sequence: number }) =>
        a.sequence - b.sequence
    );
  if (milestones.length === 0) {
    throw new Error("Payment schedule has no milestones to invoice.");
  }

  const clientRel = Array.isArray(project.client)
    ? project.client[0]
    : project.client;

  // Use `total_with_fee` when a payment method + fee are locked (i.e. the
  // customer signed on the new public-quote flow). Falls back to `amount`
  // (no fee) for legacy schedules that predate the lock. This guarantees
  // the QBO invoice total equals what the signed quote committed to.
  type MilestoneRow = {
    label: string;
    amount: number | string;
    due_date: string | null;
    payment_method: "check" | "ach" | "credit_card" | null;
    fee_amount: number | string | null;
    total_with_fee: number | string | null;
  };
  const invoiceLines = (milestones as MilestoneRow[]).map((m) => {
    const base = Number(m.amount);
    const withFee =
      m.total_with_fee != null ? Number(m.total_with_fee) : null;
    return {
      label:
        m.payment_method && withFee != null && withFee !== base
          ? `${m.label} (incl. ${m.payment_method === "credit_card" ? "card" : m.payment_method} fee)`
          : m.label,
      amount: withFee ?? base,
      due_date: m.due_date,
    };
  });

  const adapter = getQboInvoiceAdapter();
  const invoice = await adapter.createInvoice({
    project_id: projectId,
    client_name: clientRel?.name ?? "Unknown client",
    project_name: project.name,
    lines: invoiceLines,
  });

  const invoiceTotal = invoiceLines.reduce((sum, l) => sum + l.amount, 0);

  const { error: updErr } = await supabase
    .from("payment_schedules")
    .update({
      qbo_invoice_id: invoice.invoice_id,
      qbo_invoice_number: invoice.invoice_number,
    })
    .eq("id", schedule.id);
  if (updErr) throw new Error(updErr.message);

  await supabase.from("activity_log").insert({
    entity_type: "project",
    entity_id: projectId,
    action: "invoice_created",
    actor_id: actor.id,
    payload: {
      schedule_id: schedule.id,
      qbo_invoice_id: invoice.invoice_id,
      qbo_invoice_number: invoice.invoice_number,
      milestone_count: milestones.length,
      invoice_total: invoiceTotal,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/projects/${projectId}`);
}

export type BookingSmsResult =
  | { ok: true; sent: boolean; skipped?: boolean; message: string }
  | { ok: false; error: string };

/**
 * Jobber-style "Text Booking Confirmation" button. Looks up the next
 * scheduled visit for the project and SMS's the client a confirmation
 * message. Writes an `activity_log` row either way so Ronnie can prove
 * the text was sent (or see why it was skipped).
 */
export async function textBookingConfirmationAction(
  projectId: string,
): Promise<BookingSmsResult> {
  try {
    const user = await requireRole(["admin", "office"]);
    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select(
        "id, name, service_address, location, client:clients(id, name, phone)",
      )
      .eq("id", projectId)
      .single();
    if (!project) return { ok: false, error: "Project not found." };

    const clientRel = Array.isArray(project.client)
      ? project.client[0]
      : project.client;
    if (!clientRel?.phone) {
      return { ok: false, error: "Client has no phone on file." };
    }
    const phone = normalizePhone(clientRel.phone);
    if (!phone) {
      return {
        ok: false,
        error: `Couldn't parse phone "${clientRel.phone}".`,
      };
    }

    const { data: nextVisit } = await supabase
      .from("visits")
      .select("scheduled_for")
      .eq("project_id", projectId)
      .gte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();

    const when = nextVisit?.scheduled_for
      ? new Date(nextVisit.scheduled_for).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

    const address = project.service_address ?? project.location ?? null;
    const firstName = (clientRel.name ?? "").split(/\s+/)[0] || "there";
    const body = when
      ? `Hi ${firstName} — this is Rose Concrete confirming ${project.name}${
          address ? ` at ${address}` : ""
        }. We'll see you ${when}. Reply here with any questions. — Ronnie`
      : `Hi ${firstName} — this is Rose Concrete confirming your upcoming ${project.name}${
          address ? ` at ${address}` : ""
        }. We'll text the exact time once it's locked in. — Ronnie`;

    const adapter = getOpenPhoneAdapter();
    const send = await adapter.sendMessage(phone, body);

    await supabase.from("activity_log").insert({
      entity_type: "project",
      entity_id: projectId,
      action: "booking_confirmation_texted",
      actor_id: user.id,
      payload: {
        phone,
        body,
        next_visit_at: nextVisit?.scheduled_for ?? null,
        delivery: send.ok
          ? { ok: true, external_id: send.external_id }
          : { ok: false, error: send.error, skip: send.skip },
      },
    });

    revalidatePath(`/dashboard/projects/${projectId}`);

    if (send.ok) {
      return {
        ok: true,
        sent: true,
        message: `Booking confirmation texted to ${firstName}.`,
      };
    }
    if (send.skip) {
      return {
        ok: true,
        sent: false,
        skipped: true,
        message: "Logged (OpenPhone not wired — no SMS sent).",
      };
    }
    return { ok: false, error: send.error };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send.",
    };
  }
}

export async function deleteProjectAction(id: string): Promise<void> {
  await requireRole(["admin", "office"]);
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects");
}
