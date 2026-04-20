/**
 * Receipt email templating. Tiny `{{placeholder}}` substitution — we don't
 * need Handlebars for this.
 *
 * Known placeholders:
 *   {{client_name}}      — falls back to "there"
 *   {{project_name}}
 *   {{milestone_label}}
 *   {{amount}}           — USD-formatted
 *   {{paid_at}}          — M/D/YYYY
 */

export type ReceiptTemplateContext = {
  client_name: string | null;
  project_name: string;
  milestone_label: string;
  amount_dollars: number;
  paid_at: string | null;
};

const FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function renderReceiptTemplate(
  template: string,
  ctx: ReceiptTemplateContext
): string {
  const vars: Record<string, string> = {
    client_name: ctx.client_name ?? "there",
    project_name: ctx.project_name,
    milestone_label: ctx.milestone_label,
    amount: FORMATTER.format(ctx.amount_dollars),
    paid_at: ctx.paid_at
      ? new Date(ctx.paid_at).toLocaleDateString("en-US")
      : new Date().toLocaleDateString("en-US"),
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key)
      ? vars[key]
      : `{{${key}}}`;
  });
}
