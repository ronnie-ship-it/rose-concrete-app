/**
 * Project workflow helpers — seeding from templates, dependency checks,
 * business-day math for due dates and staleness.
 *
 * Service-role client is used here because seeding is called from
 * trusted server code (updateProjectAction) after auth has already been
 * verified, and RLS would otherwise force us to duplicate the role check
 * in SQL.
 */
import { createServiceRoleClient } from "@/lib/supabase/service";

export type WorkflowTemplateStep = {
  title: string;
  description?: string;
  responsible_role?: string;
  sla_business_days?: number;
  depends_on_sequence?: number;
};

export type ProjectWorkflowStep = {
  id: string;
  project_id: string;
  sequence: number;
  title: string;
  description: string | null;
  responsible_role: string | null;
  assigned_to: string | null;
  status: "pending" | "in_progress" | "done" | "skipped";
  depends_on_sequence: number | null;
  due_date: string | null;
  sla_business_days: number | null;
  in_progress_since: string | null;
  completed_at: string | null;
  completed_by: string | null;
  metadata: Record<string, unknown>;
  notes: string | null;
};

/**
 * Add N business days (Mon–Fri, no holiday calendar — Ronnie can override
 * the due_date manually on any step).
 */
export function addBusinessDays(from: Date, n: number): Date {
  const out = new Date(from);
  let added = 0;
  while (added < n) {
    out.setDate(out.getDate() + 1);
    const day = out.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return out;
}

export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  const cur = new Date(from);
  while (cur < to) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Seed workflow steps for a project from its service_type template.
 * Idempotent: returns early if steps already exist for this project.
 */
export async function seedStepsForProject(
  projectId: string
): Promise<
  | { ok: true; created: number }
  | { ok: false; error: string }
> {
  const supabase = createServiceRoleClient();

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, service_type")
    .eq("id", projectId)
    .single();
  if (projErr || !project) {
    return { ok: false, error: projErr?.message ?? "Project not found" };
  }
  if (!project.service_type) {
    return { ok: true, created: 0 };
  }

  const { data: existing } = await supabase
    .from("project_workflow_steps")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: true, created: 0 };
  }

  const { data: template } = await supabase
    .from("workflow_templates")
    .select("steps")
    .eq("service_type", project.service_type)
    .maybeSingle();
  if (!template) return { ok: true, created: 0 };

  const steps = template.steps as WorkflowTemplateStep[];
  const now = new Date();
  const rows = steps.map((s, i) => {
    // Only the first step gets its due date set at seed time; downstream
    // steps pick up their own due_date when the predecessor closes.
    const sequence = i + 1;
    const isFirst = sequence === 1;
    return {
      project_id: projectId,
      sequence,
      title: s.title,
      description: s.description ?? null,
      responsible_role: s.responsible_role ?? null,
      sla_business_days: s.sla_business_days ?? null,
      depends_on_sequence: s.depends_on_sequence ?? null,
      due_date:
        isFirst && s.sla_business_days
          ? addBusinessDays(now, s.sla_business_days)
              .toISOString()
              .slice(0, 10)
          : null,
      status: "pending",
    };
  });

  const { error } = await supabase
    .from("project_workflow_steps")
    .insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, created: rows.length };
}

export function canStartStep(
  step: ProjectWorkflowStep,
  allSteps: ProjectWorkflowStep[]
): { ok: true } | { ok: false; reason: string } {
  if (step.depends_on_sequence == null) return { ok: true };
  const prev = allSteps.find(
    (s) => s.sequence === step.depends_on_sequence
  );
  if (!prev) return { ok: true };
  if (prev.status === "done" || prev.status === "skipped") {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `Step ${prev.sequence} (${prev.title}) must be completed first.`,
  };
}

/**
 * Default 14-step concrete job checklist. Seeded when a quote is
 * approved (either via the public /q/<token> flow or the manual
 * "Mark as Approved" button) and the project has no existing
 * workflow steps. Keeps the 11-step sidewalk-specific template
 * (migration 017) as the more-specialized branch; this is the
 * fallback that applies to every service_type.
 *
 * Each step carries a default SLA in business days + a
 * responsible_role hint so the crew/office filter works.
 */
export const DEFAULT_JOB_CHECKLIST: WorkflowTemplateStep[] = [
  {
    title: "Call customer to confirm start",
    description:
      "Reach out within 2 business days of approval to lock a start date.",
    responsible_role: "office",
    sla_business_days: 2,
  },
  {
    title: "Verify permits + dial 811",
    description:
      "File any city permits + place the 811 utility-locate call 72h before demo.",
    responsible_role: "office",
    sla_business_days: 3,
    depends_on_sequence: 1,
  },
  {
    title: "Send pre-demo acknowledgment",
    description:
      "Customer signs the welcome-video + disclaimer form before demo day.",
    responsible_role: "office",
    sla_business_days: 2,
    depends_on_sequence: 2,
  },
  {
    title: "Schedule demo crew",
    description: "Text Willy with demo dates + scope.",
    responsible_role: "office",
    sla_business_days: 2,
    depends_on_sequence: 3,
  },
  {
    title: "Demo day — tear-out complete",
    description: "Remove existing concrete, haul debris, site broom-clean.",
    responsible_role: "crew",
    sla_business_days: 2,
    depends_on_sequence: 4,
  },
  {
    title: "Subgrade + compaction",
    description: "Compact to 90%, verify grade, wet down.",
    responsible_role: "crew",
    sla_business_days: 1,
    depends_on_sequence: 5,
  },
  {
    title: "Set forms + rebar",
    description: "Stake forms, set rebar on chairs, double-check layout.",
    responsible_role: "crew",
    sla_business_days: 1,
    depends_on_sequence: 6,
  },
  {
    title: "Customer signs pre-pour inspection",
    description:
      "Confirm mix, joint pattern, finish, color, special requests.",
    responsible_role: "office",
    sla_business_days: 1,
    depends_on_sequence: 7,
  },
  {
    title: "Order concrete",
    description: "Lock the mix with the plant + confirm truck times.",
    responsible_role: "office",
    sla_business_days: 1,
    depends_on_sequence: 8,
  },
  {
    title: "Pour day — placement + finish",
    description: "Pump / chute, screed, float, broom or stamp.",
    responsible_role: "crew",
    sla_business_days: 1,
    depends_on_sequence: 9,
  },
  {
    title: "Control-joint cutting",
    description: "Early-entry saw within 4-12h of finish.",
    responsible_role: "crew",
    sla_business_days: 1,
    depends_on_sequence: 10,
  },
  {
    title: "Strip forms + cleanup",
    description: "Remove forms 24-48h after pour, haul debris, sweep.",
    responsible_role: "crew",
    sla_business_days: 2,
    depends_on_sequence: 11,
  },
  {
    title: "Final walkthrough + completion form",
    description: "Walk the slab with the customer, collect sign-off signature.",
    responsible_role: "office",
    sla_business_days: 2,
    depends_on_sequence: 12,
  },
  {
    title: "Generate final invoice",
    description: "QBO invoice for locked total + any approved change orders.",
    responsible_role: "office",
    sla_business_days: 1,
    depends_on_sequence: 13,
  },
];

/**
 * Seed the 14-step default checklist on a project. Idempotent —
 * returns `created: 0` if any workflow steps already exist. Called
 * from the approve-quote flow so every newly-approved project
 * lands with a ready-to-schedule list.
 */
export async function seedDefaultJobChecklist(
  projectId: string,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("project_workflow_steps")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: true, created: 0 };
  }
  const now = new Date();
  const rows = DEFAULT_JOB_CHECKLIST.map((s, i) => {
    const sequence = i + 1;
    const isFirst = sequence === 1;
    return {
      project_id: projectId,
      sequence,
      title: s.title,
      description: s.description ?? null,
      responsible_role: s.responsible_role ?? null,
      sla_business_days: s.sla_business_days ?? null,
      depends_on_sequence: s.depends_on_sequence ?? null,
      due_date:
        isFirst && s.sla_business_days
          ? addBusinessDays(now, s.sla_business_days)
              .toISOString()
              .slice(0, 10)
          : null,
      status: "pending" as const,
    };
  });
  const { error } = await supabase
    .from("project_workflow_steps")
    .insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, created: rows.length };
}

export function stepIsStale(
  step: ProjectWorkflowStep,
  thresholdBusinessDays = 3,
  now: Date = new Date()
): boolean {
  if (step.status === "done" || step.status === "skipped") return false;
  const anchor = step.in_progress_since
    ? new Date(step.in_progress_since)
    : null;
  if (!anchor) return false;
  return businessDaysBetween(anchor, now) >= thresholdBusinessDays;
}
