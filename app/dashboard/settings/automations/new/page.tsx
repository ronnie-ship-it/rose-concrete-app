import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { RuleForm } from "../rule-form";

export const metadata = { title: "New automation rule — Rose Concrete" };

export default async function NewAutomationRulePage() {
  await requireRole(["admin"]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="New automation rule"
        subtitle="Pick a trigger + add one or more actions. Rules fire when the trigger event happens."
        actions={
          <Link
            href="/dashboard/settings/automations"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← All automations
          </Link>
        }
      />
      <Card>
        <RuleForm
          rule={{
            name: "",
            description: null,
            trigger: "quote_approved",
            is_enabled: true,
            conditions: {},
            actions: [],
          }}
        />
      </Card>
    </div>
  );
}
