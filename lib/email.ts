/**
 * Email sender adapter — Resend-backed with a clean skip fallback.
 *
 * Real implementation uses Resend's transactional API (POST /emails). We
 * call it directly via fetch (no SDK) so there's no new dependency and
 * edge-runtime friendliness is automatic. Pick Resend over SendGrid for:
 *   - instant signup, no phone-verification
 *   - simple JSON payload, no library bloat
 *   - one API key covers all of Ronnie's sends
 *
 * Env vars:
 *   RESEND_API_KEY        - API key from resend.com
 *   LEAD_NOTIFICATION_FROM - "Rose Concrete <leads@sandiegoconcrete.ai>"
 *                           (legacy: RESEND_FROM_EMAIL is still honored)
 *   RESEND_REPLY_TO       - optional; defaults to the FROM address
 *
 * `getEmailAdapter()` returns the real adapter when RESEND_API_KEY is set,
 * else a stub that reports `skip: true` so callers can branch their copy.
 */

export type EmailSendInput = {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. If absent, Resend auto-converts `text`. */
  html?: string;
  replyTo?: string | null;
  /** Tag for Resend dashboard analytics. */
  tag?: string;
};

export type EmailSendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; skip: boolean };

export type EmailAdapter = {
  send(input: EmailSendInput): Promise<EmailSendResult>;
  isConfigured(): boolean;
};

export function createStubEmailAdapter(): EmailAdapter {
  return {
    async send() {
      return {
        ok: false,
        error: "Email adapter not configured (RESEND_API_KEY missing).",
        skip: true,
      };
    },
    isConfigured() {
      return false;
    },
  };
}

const RESEND_URL = "https://api.resend.com/emails";

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
};

export function createResendAdapter(apiKey: string): EmailAdapter {
  const from =
    process.env.LEAD_NOTIFICATION_FROM ??
    process.env.RESEND_FROM_EMAIL ??
    "Rose Concrete <onboarding@resend.dev>";
  const defaultReplyTo = process.env.RESEND_REPLY_TO ?? null;

  return {
    isConfigured() {
      return true;
    },
    async send(input) {
      if (!input.to || !/.+@.+\..+/.test(input.to)) {
        return { ok: false, error: "Invalid 'to' address.", skip: false };
      }
      try {
        const body: Record<string, unknown> = {
          from,
          to: [input.to],
          subject: input.subject.slice(0, 998),
          text: input.text,
        };
        if (input.html) body.html = input.html;
        const replyTo = input.replyTo ?? defaultReplyTo;
        if (replyTo) body.reply_to = [replyTo];
        if (input.tag) body.tags = [{ name: "tag", value: input.tag }];

        const res = await fetch(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as ResendResponse;
        if (!res.ok) {
          return {
            ok: false,
            error: `Resend ${res.status}: ${json.message ?? json.name ?? res.statusText}`,
            skip: false,
          };
        }
        return { ok: true, id: json.id ?? null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Resend fetch failed.",
          skip: false,
        };
      }
    },
  };
}

export function getEmailAdapter(): EmailAdapter {
  const key = process.env.RESEND_API_KEY;
  if (!key) return createStubEmailAdapter();
  return createResendAdapter(key);
}

export function emailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
