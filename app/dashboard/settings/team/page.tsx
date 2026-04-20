import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { TeamTable } from "./team-table";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Manage team — Rose Concrete" };

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "office" | "crew";
  created_at: string;
};

export default async function TeamPage() {
  const actor = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: true });

  const members = (data ?? []) as Member[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage team"
        subtitle="Office + crew with login access. Roles: admin (full access), office (dispatch + billing), crew (mobile + visits)."
      />

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">
          Invite a teammate
        </h3>
        <InviteForm />
      </Card>

      <TeamTable members={members} currentUserId={actor.id} />
    </div>
  );
}
