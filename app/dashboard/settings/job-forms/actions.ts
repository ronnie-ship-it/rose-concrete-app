"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";

type Item = {
  key: string;
  label: string;
  type: "check" | "text" | "photo";
  required: boolean;
};

function parseItems(raw: string): Item[] {
  const out: Item[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  lines.forEach((line, i) => {
    let required = false;
    let body = line;
    if (body.startsWith("*")) {
      required = true;
      body = body.slice(1).trim();
    }
    const [typePart, ...rest] = body.split("|");
    const rawType = typePart?.trim().toLowerCase() ?? "check";
    const label = rest.join("|").trim();
    if (!label) return;
    const type: Item["type"] =
      rawType === "text" || rawType === "photo" ? rawType : "check";
    out.push({
      key: `item_${i + 1}`,
      label,
      type,
      required,
    });
  });
  return out;
}

export async function createJobFormTemplateAction(fd: FormData): Promise<void> {
  await requireRole(["admin"]);
  const name = String(fd.get("name") ?? "").trim();
  const kind = String(fd.get("kind") ?? "custom");
  const raw = String(fd.get("items") ?? "");
  if (!name) return;
  const items = parseItems(raw);
  if (items.length === 0) return;
  const required = fd.get("is_required_to_complete") === "on";

  const supabase = createServiceRoleClient();
  await supabase.from("job_form_templates").insert({
    name,
    kind,
    items,
    is_required_to_complete: required,
    is_active: true,
  });
  revalidatePath("/dashboard/settings/job-forms");
}

export async function deleteJobFormTemplateAction(id: string): Promise<void> {
  await requireRole(["admin"]);
  const supabase = createServiceRoleClient();
  await supabase.from("job_form_templates").delete().eq("id", id);
  revalidatePath("/dashboard/settings/job-forms");
}

export async function toggleJobFormTemplateAction(
  id: string,
  isActive: boolean
): Promise<void> {
  await requireRole(["admin"]);
  const supabase = createServiceRoleClient();
  await supabase
    .from("job_form_templates")
    .update({ is_active: isActive })
    .eq("id", id);
  revalidatePath("/dashboard/settings/job-forms");
}
