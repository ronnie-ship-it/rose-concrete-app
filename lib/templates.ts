/**
 * Merge-token render for `message_templates`.
 *
 * Token syntax: `{token_name}` — case-sensitive, letters / digits /
 * underscore. Unknown tokens are left as-is so the output is never
 * silently wrong (Ronnie sees `{foo}` and knows to fix the token or the
 * call site). `{}` without a name is rendered literally.
 */
import { createServiceRoleClient } from "@/lib/supabase/service";

const TOKEN_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export type TemplateRow = {
  slug: string;
  label: string;
  email_subject: string | null;
  email_body: string | null;
  sms_body: string | null;
  send_email: boolean;
  send_sms: boolean;
  is_active: boolean;
};

export function renderTemplate(
  text: string | null,
  tokens: Record<string, string | number | null | undefined>,
): string {
  if (!text) return "";
  return text.replace(TOKEN_RE, (match, key: string) => {
    const val = tokens[key];
    if (val == null || val === "") return match;
    return String(val);
  });
}

export async function loadTemplate(
  slug: string,
): Promise<TemplateRow | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("message_templates")
    .select(
      "slug, label, email_subject, email_body, sms_body, send_email, send_sms, is_active",
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

/**
 * Helper for callers that already have a Supabase client (e.g. inside a
 * server action or cron). Skips the per-call service-role ctor.
 */
export async function loadTemplateWith(
  supabase: ReturnType<typeof createServiceRoleClient>,
  slug: string,
): Promise<TemplateRow | null> {
  const { data } = await supabase
    .from("message_templates")
    .select(
      "slug, label, email_subject, email_body, sms_body, send_email, send_sms, is_active",
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

/** Set of tokens a caller might pass — useful for the settings preview. */
export function extractTokens(text: string | null): string[] {
  if (!text) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE);
  while ((m = re.exec(text)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}
