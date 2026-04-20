/**
 * Customer form engine — the three token-gated flows:
 *   1. demo_ack    — welcome video + disclaimer acknowledgment
 *   2. pre_pour    — mix / pattern / finish / color confirm + initials
 *   3. completion  — line-item confirm + satisfaction + signature
 *
 * One row per (project, kind) in customer_forms. Responses land in
 * customer_form_responses. The public `/forms/<token>` page is the
 * single entry point the customer hits — it reads the form row,
 * renders the items, captures answers, and calls
 * `submitCustomerFormAction`.
 *
 * We DON'T create forms from a hardcoded switch statement at send
 * time — we call `ensureCustomerForm(projectId, kind)` which upserts
 * the form with the canonical items for that kind. That way Ronnie
 * can tweak items later by editing the JSON on the row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type CustomerFormKind =
  | "demo_ack"
  | "pre_pour"
  | "completion"
  | "custom";

export type CustomerFormStatus =
  | "draft"
  | "sent"
  | "completed"
  | "expired";

export type FormItem = {
  key: string;
  label: string;
  /** `acknowledge` = single checkbox "I understand",
   *  `confirm_initials` = confirm + type initials,
   *  `text` = free-form input (for notes),
   *  `signature` = signature pad at the end. */
  kind: "acknowledge" | "confirm_initials" | "text" | "signature";
  required?: boolean;
  helper?: string;
};

export type CustomerFormRow = {
  id: string;
  project_id: string;
  kind: CustomerFormKind;
  status: CustomerFormStatus;
  token: string;
  title: string;
  intro_markdown: string | null;
  video_url: string | null;
  items: FormItem[];
  sent_at: string | null;
  sent_via: string | null;
  completed_at: string | null;
};

// ─────────────────────────────────────────────────────────────────────────
// Canonical item lists for each built-in kind. Keep deliberately short —
// every extra checkbox is friction. Customer-facing copy lives here so
// all three forms read consistent.
// ─────────────────────────────────────────────────────────────────────────
function defaultFormSpec(kind: CustomerFormKind): {
  title: string;
  intro: string;
  items: FormItem[];
} {
  if (kind === "demo_ack") {
    return {
      title: "Welcome + demo disclaimer",
      intro:
        "Thanks for the opportunity to pour for you. Before our crew starts demo, please watch the short video above and acknowledge the demo risks below. We take every precaution, but breakage of unmarked lines or hidden obstructions is a possibility we want you to hear about up front.",
      items: [
        {
          key: "ack_irrigation",
          label:
            "I understand that buried irrigation lines may be damaged during demo. If the location of lines is critical, I will mark them before demo begins.",
          kind: "acknowledge",
          required: true,
        },
        {
          key: "ack_gas",
          label:
            "I understand that buried gas / utility lines could be impacted and that Rose Concrete will call 811 before digging, but unmarked private lines are at owner's risk.",
          kind: "acknowledge",
          required: true,
        },
        {
          key: "ack_trees",
          label:
            "I understand that tree roots near the work area may be cut if they interfere with prep — this is sometimes unavoidable.",
          kind: "acknowledge",
          required: true,
        },
        {
          key: "ack_cracks",
          label:
            "I understand that adjacent existing concrete may develop additional cracks during demo and that Rose Concrete is not responsible for pre-existing conditions.",
          kind: "acknowledge",
          required: true,
        },
        {
          key: "notes",
          label: "Anything else we should know?",
          kind: "text",
        },
        {
          key: "signature",
          label: "Signed by the homeowner",
          kind: "signature",
          required: true,
        },
      ],
    };
  }
  if (kind === "pre_pour") {
    return {
      title: "Pre-pour confirmation",
      intro:
        "We're ordering concrete in the next 24 hours. Please confirm each of the following so we get the pour right the first time. Initial each line and sign at the end.",
      items: [
        {
          key: "mix_design",
          label: "Mix design matches what we discussed (psi / air / additives).",
          kind: "confirm_initials",
          required: true,
        },
        {
          key: "joint_pattern",
          label: "Control-joint pattern + layout is what you want.",
          kind: "confirm_initials",
          required: true,
        },
        {
          key: "finish_type",
          label: "Finish type (broom / stamp / troweled / exposed) is correct.",
          kind: "confirm_initials",
          required: true,
        },
        {
          key: "color",
          label: "Color (if integral / release) is correct.",
          kind: "confirm_initials",
          required: true,
        },
        {
          key: "special_requests",
          label: "Any special requests noted in the quote are included.",
          kind: "confirm_initials",
          required: true,
        },
        {
          key: "notes",
          label: "Last-minute notes / changes",
          kind: "text",
        },
        {
          key: "signature",
          label: "Signed to authorize pour order",
          kind: "signature",
          required: true,
        },
      ],
    };
  }
  if (kind === "completion") {
    return {
      title: "Job completion sign-off",
      intro:
        "Our crew has wrapped up. Please walk the site and confirm that the work listed below is complete and that you're satisfied. Any punch-list items, note them below and we'll address them before we leave.",
      items: [
        {
          key: "work_complete",
          label: "All line items appear complete on site.",
          kind: "acknowledge",
          required: true,
        },
        {
          key: "work_satisfactory",
          label: "The finished work is satisfactory.",
          kind: "acknowledge",
          required: true,
        },
        {
          key: "punch_list",
          label: "Punch-list / notes (optional)",
          kind: "text",
        },
        {
          key: "signature",
          label: "Signed — work accepted",
          kind: "signature",
          required: true,
        },
      ],
    };
  }
  return { title: "Form", intro: "", items: [] };
}

/**
 * Upsert a customer form for (project, kind). If a row exists we
 * refresh the item list / title / intro from the default spec (so
 * Ronnie always gets the latest copy) but keep the token + any
 * existing response.
 */
export async function ensureCustomerForm(
  projectId: string,
  kind: CustomerFormKind,
  opts: { videoUrl?: string | null } = {},
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<CustomerFormRow> {
  const spec = defaultFormSpec(kind);
  const { data: existing } = await supabase
    .from("customer_forms")
    .select("*")
    .eq("project_id", projectId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing) {
    // Refresh the template content; keep token + status.
    const { data: updated } = await supabase
      .from("customer_forms")
      .update({
        title: spec.title,
        intro_markdown: spec.intro,
        items: spec.items,
        video_url: opts.videoUrl ?? existing.video_url ?? null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    return (updated ?? existing) as CustomerFormRow;
  }
  const { data: inserted } = await supabase
    .from("customer_forms")
    .insert({
      project_id: projectId,
      kind,
      status: "draft",
      title: spec.title,
      intro_markdown: spec.intro,
      items: spec.items,
      video_url: opts.videoUrl ?? null,
    })
    .select("*")
    .single();
  return inserted as CustomerFormRow;
}

/** Mark a form as sent (stamps sent_at / sent_via). */
export async function stampFormSent(
  formId: string,
  sentVia: "email" | "sms" | "hub",
  supabase: SupabaseClient = createServiceRoleClient(),
): Promise<void> {
  await supabase
    .from("customer_forms")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_via: sentVia,
    })
    .eq("id", formId);
}
