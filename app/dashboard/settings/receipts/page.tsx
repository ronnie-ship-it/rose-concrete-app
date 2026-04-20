import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui";
import { renderReceiptTemplate } from "@/lib/receipt-templates";
import { ReceiptsForm } from "./receipts-form";

export const metadata = { title: "Receipts — Rose Concrete" };

/**
 * Admin-only settings for the receipt auto-send worker. Shows the current
 * template, lets Ronnie edit sender + subject + body, and toggles the
 * feature flag. Preview pane renders the template against sample data so
 * the {{placeholder}} substitutions are visible before saving.
 */

export default async function ReceiptsSettingsPage() {
  await requireRole(["admin"]);

  const supabase = await createClient();

  const [settingsRes, flagRes] = await Promise.all([
    supabase
      .from("invoice_settings")
      .select(
        "receipt_sender_email, receipt_subject_template, receipt_body_template"
      )
      .limit(1)
      .maybeSingle(),
    supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "qbo_receipt_auto_send")
      .maybeSingle(),
  ]);

  const settings = settingsRes.data;
  const enabled = !!flagRes.data?.enabled;

  // Columns from migration 010 may not be present yet — show a clear
  // banner in that case instead of crashing or editing nothing.
  const schemaReady =
    settings?.receipt_sender_email !== undefined &&
    settings?.receipt_subject_template !== undefined;

  const subject =
    (settings?.receipt_subject_template as string | undefined) ??
    "Receipt for {{milestone_label}} — {{project_name}}";
  const body =
    (settings?.receipt_body_template as string | undefined) ??
    "Hi {{client_name}}, thanks for your payment of {{amount}}.";
  const sender =
    (settings?.receipt_sender_email as string | undefined) ??
    "ronnie@sandiegoconcrete.ai";

  const sampleCtx = {
    client_name: "Maria Johnson",
    project_name: "123 Elm — patio pour",
    milestone_label: "50% deposit",
    amount_dollars: 4500,
    paid_at: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment receipts"
        subtitle="Auto-send a thank-you + QBO receipt PDF whenever a milestone flips to paid. Gmail MCP adapter is stubbed — flip the flag when you want the worker to start actually sending."
      />

      {!schemaReady && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Run migration 010 first.</p>
          <p className="mt-1">
            The receipt template columns (<code>receipt_sender_email</code>,{" "}
            <code>receipt_subject_template</code>,{" "}
            <code>receipt_body_template</code>) aren't on{" "}
            <code>invoice_settings</code> yet. Paste{" "}
            <code>migrations/010_receipt_settings.sql</code> into the Supabase
            SQL editor and reload.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <ReceiptsForm
              initial={{
                receipt_sender_email: sender,
                receipt_subject_template: subject,
                receipt_body_template: body,
                qbo_receipt_auto_send: enabled,
              }}
              disabled={!schemaReady}
            />
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Preview · sample send
          </h2>
          <Card>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">
                  From
                </dt>
                <dd className="font-mono text-xs">{sender}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">
                  Subject
                </dt>
                <dd className="font-medium text-neutral-900">
                  {renderReceiptTemplate(subject, sampleCtx)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">
                  Body
                </dt>
                <dd className="whitespace-pre-wrap text-sm text-neutral-700">
                  {renderReceiptTemplate(body, sampleCtx)}
                </dd>
              </div>
            </dl>
          </Card>
          <p className="text-xs text-neutral-500">
            Placeholders: <code>{"{{client_name}}"}</code>,{" "}
            <code>{"{{project_name}}"}</code>,{" "}
            <code>{"{{milestone_label}}"}</code>, <code>{"{{amount}}"}</code>,{" "}
            <code>{"{{paid_at}}"}</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
