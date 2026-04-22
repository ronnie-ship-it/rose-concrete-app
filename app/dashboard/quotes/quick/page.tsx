import { requireRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { QuickQuoteForm } from "./form";

export const metadata = { title: "Quick quote — Rose Concrete" };

/**
 * Quick quote flow. Ronnie's fastest path from "client just called"
 * to "draft quote ready to send". No pre-existing project required —
 * the action auto-creates a placeholder project at the submitted
 * address and opens the full quote editor for line-item refinement.
 */
export default async function QuickQuotePage() {
  await requireRole(["admin", "office"]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quick quote"
        subtitle="Start a quote in 30 seconds — pick a client (or type a new one), set the address, drop in a starting price. We'll create the project for you and open the editor to refine."
      />
      <Card>
        <QuickQuoteForm />
      </Card>
    </div>
  );
}
