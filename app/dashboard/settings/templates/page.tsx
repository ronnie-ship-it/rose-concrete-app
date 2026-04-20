import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { TemplateCard } from "./template-card";

export const metadata = { title: "Message templates — Rose Concrete" };

type Row = {
  slug: string;
  label: string;
  description: string | null;
  email_subject: string | null;
  email_body: string | null;
  sms_body: string | null;
  send_email: boolean;
  send_sms: boolean;
  is_active: boolean;
  updated_at: string;
};

const TOKEN_REFERENCE: Array<{
  category: string;
  tokens: Array<{ name: string; desc: string }>;
}> = [
  {
    category: "Customer",
    tokens: [
      { name: "first_name", desc: "Customer's first name" },
      { name: "last_name", desc: "Last name" },
      { name: "client_name", desc: "Full name or business name" },
      { name: "client_email", desc: "Email address" },
      { name: "client_phone", desc: "Phone number" },
    ],
  },
  {
    category: "Project / Visit",
    tokens: [
      { name: "project_name", desc: "Project / job name" },
      { name: "service_address", desc: "Street + city / ZIP" },
      { name: "visit_time", desc: "Scheduled visit date + time" },
      { name: "eta_minutes", desc: "On-my-way ETA in minutes" },
    ],
  },
  {
    category: "Money",
    tokens: [
      { name: "amount", desc: "Formatted milestone amount" },
      { name: "milestone_label", desc: "e.g. 'Final balance'" },
      { name: "pay_url", desc: "Secure pay link" },
      { name: "quote_url", desc: "Public quote approval link" },
      { name: "quote_number", desc: "Quote #" },
    ],
  },
  {
    category: "Marketing",
    tokens: [{ name: "review_url", desc: "Google review URL" }],
  },
];

export default async function TemplatesSettingsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select(
      "slug, label, description, email_subject, email_body, sms_body, send_email, send_sms, is_active, updated_at",
    )
    .order("slug", { ascending: true });

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email & SMS templates"
        subtitle="Every automated message the system sends, with editable copy + merge tokens. Edits are live immediately."
      />

      <Card>
        <h3 className="text-sm font-semibold text-neutral-800">
          Available merge tokens
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Wrap with curly braces in the body or subject — e.g.{" "}
          <code>{`{first_name}`}</code>. Unknown tokens pass through
          unchanged so you can spot typos.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOKEN_REFERENCE.map((g) => (
            <div key={g.category}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {g.category}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {g.tokens.map((t) => (
                  <li key={t.name}>
                    <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
                      {`{${t.name}}`}
                    </code>{" "}
                    <span className="text-neutral-500">{t.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            No templates seeded. Run <code>migrations/029_message_templates.sql</code>.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <TemplateCard key={row.slug} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
