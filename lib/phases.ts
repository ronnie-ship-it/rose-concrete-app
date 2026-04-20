/**
 * Project phases — demo → prep → pour → cleanup → inspection.
 *
 * Each phase is a row in `project_phases` (migration 038). This module
 * owns:
 *   - seedDefaultPhases(projectId) — creates the 5 default rows when
 *     a project flips to approved + phases are empty.
 *   - draftPhaseText({ phaseId }) — builds the SMS draft body + to-list
 *     for a given phase, rendered against the business_profile
 *     templates with merge tokens filled in. Ronnie reviews the
 *     draft before it sends — we never auto-send.
 *
 * The draft body + to-list get stored on the phase row itself so the
 * UI can show them, let Ronnie tweak, and stamp sent_at when he taps
 * Send. OpenPhone delivery lives in app/dashboard/projects/[id]/
 * phase-actions.ts (the UI layer) since it revalidatePaths.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { renderTemplate } from "@/lib/templates";

export type PhaseKind =
  | "demo"
  | "prep"
  | "pour"
  | "cleanup"
  | "inspection"
  | "custom";

export type PhaseStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "done"
  | "skipped";

export type PhaseRow = {
  id: string;
  project_id: string;
  kind: PhaseKind;
  label: string;
  sequence: number;
  start_date: string | null;
  end_date: string | null;
  status: PhaseStatus;
  notes: string | null;
  text_draft_body: string | null;
  text_draft_to: string | null;
  text_sent_at: string | null;
};

// Default phase definitions + their typical duration. `daysAfter`
// is the gap from the previous phase's end — used only as a hint
// when Ronnie hasn't picked dates yet.
export const DEFAULT_PHASES: Array<{
  kind: PhaseKind;
  label: string;
  defaultDurationDays: number;
}> = [
  { kind: "demo", label: "Demo", defaultDurationDays: 2 },
  { kind: "prep", label: "Prep", defaultDurationDays: 2 },
  { kind: "pour", label: "Pour day", defaultDurationDays: 1 },
  { kind: "cleanup", label: "Cleanup", defaultDurationDays: 1 },
  { kind: "inspection", label: "Completion inspection", defaultDurationDays: 1 },
];

/**
 * Seed the five default phases for a project. Idempotent — if any
 * phases already exist, does nothing. Called when a project flips
 * from `quoting` / `approved` into the scheduling flow.
 */
export async function seedDefaultPhases(
  projectId: string,
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<PhaseRow[]> {
  const { data: existing } = await supabase
    .from("project_phases")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);
  if (existing && existing.length > 0) {
    const { data: rows } = await supabase
      .from("project_phases")
      .select("*")
      .eq("project_id", projectId)
      .order("sequence");
    return (rows ?? []) as PhaseRow[];
  }
  const rows = DEFAULT_PHASES.map((p, i) => ({
    project_id: projectId,
    kind: p.kind,
    label: p.label,
    sequence: i,
    status: "pending" as PhaseStatus,
  }));
  const { data: inserted } = await supabase
    .from("project_phases")
    .insert(rows)
    .select("*");
  return (inserted ?? []) as PhaseRow[];
}

type BusinessTextFields = {
  welcome_video_url?: string | null;
  phase_text_demo?: string | null;
  phase_text_prep?: string | null;
  phase_text_pour?: string | null;
  phase_text_cleanup?: string | null;
  phase_to_demo?: string | null;
  phase_to_pour?: string | null;
};

// Fallback copy used when Ronnie hasn't edited the business_profile
// templates yet. Merge tokens: {client_name}, {address}, {dates},
// {service_type}, {notes}.
const DEFAULT_TEMPLATES: Record<
  Exclude<PhaseKind, "inspection" | "custom">,
  string
> = {
  demo: `Hey Willy — demo job for {client_name} at {address} {dates}. Scope: {service_type}. Bring the usual demo kit; let me know if you need extra manpower.`,
  prep: `Hey crew — prep starts {dates} at {address} for {client_name}. Plan to set forms + rebar. Let me know when you're on site.`,
  pour: `Pour day scheduled {dates} at {address} for {client_name}. {service_type}. Willy Roger Michael — confirm truck times when we lock the dispatcher.`,
  cleanup: `Cleanup at {address} on {dates} — strip forms, haul debris, site broom-clean. Text me when it's buttoned up.`,
};

export async function buildPhaseText(
  phase: PhaseRow,
  opts: {
    clientName: string;
    address: string;
    serviceType: string | null;
    business: BusinessTextFields | null;
  },
): Promise<{ body: string; to: string }> {
  const tokens: Record<string, string> = {
    client_name: opts.clientName,
    address: opts.address,
    service_type: opts.serviceType ?? "",
    notes: phase.notes ?? "",
    dates: formatDateRange(phase.start_date, phase.end_date),
  };

  const template =
    (phase.kind === "demo" && opts.business?.phase_text_demo) ||
    (phase.kind === "prep" && opts.business?.phase_text_prep) ||
    (phase.kind === "pour" && opts.business?.phase_text_pour) ||
    (phase.kind === "cleanup" && opts.business?.phase_text_cleanup) ||
    (phase.kind === "demo" && DEFAULT_TEMPLATES.demo) ||
    (phase.kind === "prep" && DEFAULT_TEMPLATES.prep) ||
    (phase.kind === "pour" && DEFAULT_TEMPLATES.pour) ||
    (phase.kind === "cleanup" && DEFAULT_TEMPLATES.cleanup) ||
    "";

  const to =
    (phase.kind === "demo" && opts.business?.phase_to_demo) ||
    (phase.kind === "pour" && opts.business?.phase_to_pour) ||
    "";

  return {
    body: template ? renderTemplate(template, tokens) : "",
    to: to ?? "",
  };
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "TBD";
  if (start && end && start !== end) {
    return `${humanDate(start)} – ${humanDate(end)}`;
  }
  return humanDate(start ?? end ?? "");
}

function humanDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
