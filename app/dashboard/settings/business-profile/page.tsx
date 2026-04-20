import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { BusinessProfileForm } from "./form";

export const metadata = { title: "Business profile — Rose Concrete" };

type Hours = Record<
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
  { open: string | null; close: string | null }
>;

type Row = {
  company_name: string;
  legal_name: string | null;
  tagline: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  license_number: string | null;
  public_listing: boolean;
  keep_address_private: boolean;
  hours: Hours;
  // Welcome video + phase-text templates (migration 038).
  welcome_video_url: string | null;
  phase_text_demo: string | null;
  phase_text_prep: string | null;
  phase_text_pour: string | null;
  phase_text_cleanup: string | null;
  phase_to_demo: string | null;
  phase_to_pour: string | null;
  updated_at: string;
};

const DEFAULT_HOURS: Hours = {
  sun: { open: null, close: null },
  mon: { open: "09:00", close: "17:00" },
  tue: { open: "09:00", close: "17:00" },
  wed: { open: "09:00", close: "17:00" },
  thu: { open: "09:00", close: "17:00" },
  fri: { open: "09:00", close: "17:00" },
  sat: { open: null, close: null },
};

export default async function BusinessProfilePage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_profile")
    .select("*")
    .limit(1)
    .maybeSingle();

  const row: Row = {
    company_name: (data?.company_name as string) ?? "Rose Concrete",
    legal_name: (data?.legal_name as string | null) ?? null,
    tagline: (data?.tagline as string | null) ?? null,
    bio: (data?.bio as string | null) ?? null,
    phone: (data?.phone as string | null) ?? null,
    email: (data?.email as string | null) ?? null,
    website: (data?.website as string | null) ?? null,
    address_line_1: (data?.address_line_1 as string | null) ?? null,
    address_line_2: (data?.address_line_2 as string | null) ?? null,
    city: (data?.city as string | null) ?? null,
    state: (data?.state as string | null) ?? "CA",
    postal_code: (data?.postal_code as string | null) ?? null,
    license_number: (data?.license_number as string | null) ?? null,
    public_listing: (data?.public_listing as boolean | null) ?? true,
    keep_address_private:
      (data?.keep_address_private as boolean | null) ?? false,
    hours: (data?.hours as Hours | null) ?? DEFAULT_HOURS,
    welcome_video_url: (data?.welcome_video_url as string | null) ?? null,
    phase_text_demo: (data?.phase_text_demo as string | null) ?? null,
    phase_text_prep: (data?.phase_text_prep as string | null) ?? null,
    phase_text_pour: (data?.phase_text_pour as string | null) ?? null,
    phase_text_cleanup: (data?.phase_text_cleanup as string | null) ?? null,
    phase_to_demo: (data?.phase_to_demo as string | null) ?? null,
    phase_to_pour: (data?.phase_to_pour as string | null) ?? null,
    updated_at: (data?.updated_at as string) ?? new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business profile"
        subtitle="Company info shown on the client hub, receipts, and Google listings. Visible to anyone with a hub link."
      />
      <Card>
        <BusinessProfileForm initial={row} />
      </Card>
      <p className="text-xs text-neutral-500">
        Last updated {new Date(row.updated_at).toLocaleString()}.
      </p>
    </div>
  );
}
