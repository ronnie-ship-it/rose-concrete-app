import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { WorkSettingsForm } from "./form";

export const metadata = { title: "Work settings — Rose Concrete" };

type Hours = Record<
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
  { start: string | null; end: string | null }
>;

const DEFAULT_HOURS: Hours = {
  sun: { start: null, end: null },
  mon: { start: "07:00", end: "17:00" },
  tue: { start: "07:00", end: "17:00" },
  wed: { start: "07:00", end: "17:00" },
  thu: { start: "07:00", end: "17:00" },
  fri: { start: "07:00", end: "17:00" },
  sat: { start: null, end: null },
};

export default async function WorkSettingsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const initial = {
    default_visit_min: Number(data?.default_visit_min ?? 60),
    buffer_between_min: Number(data?.buffer_between_min ?? 15),
    working_hours: (data?.working_hours as Hours | null) ?? DEFAULT_HOURS,
    first_day_of_week: Number(data?.first_day_of_week ?? 1),
    timezone: (data?.timezone as string) ?? "America/Los_Angeles",
    updated_at: (data?.updated_at as string) ?? new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work settings"
        subtitle="Scheduling defaults used when creating visits and rendering the schedule grid."
      />
      <Card>
        <WorkSettingsForm initial={initial} />
      </Card>
      <p className="text-xs text-neutral-500">
        Last updated {new Date(initial.updated_at).toLocaleString()}.
      </p>
    </div>
  );
}
