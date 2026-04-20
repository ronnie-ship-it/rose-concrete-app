/**
 * Adapters for sending a payment reminder over email (Gmail) and SMS
 * (OpenPhone). Both are stubbed until MCP creds / server-to-server tokens
 * are configured — the cron route calls these and marks the reminder row
 * sent/failed based on the return value.
 *
 * Kept as a small adapter interface so the cron route has no knowledge of
 * Gmail / OpenPhone specifics. Swap in real senders later without touching
 * the cron.
 */

export type ReminderContext = {
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  project_name: string;
  milestone_label: string;
  amount: number;
  due_date: string | null;
  pay_url: string;
  offset_days: number;
};

export type SendResult =
  | { ok: true; message_id: string | null }
  | { ok: false; error: string; skip: boolean };

export type ReminderSenders = {
  sendEmail(ctx: ReminderContext): Promise<SendResult>;
  sendSms(ctx: ReminderContext): Promise<SendResult>;
};

export function buildReminderCopy(ctx: ReminderContext): {
  subject: string;
  body: string;
} {
  const { offset_days } = ctx;
  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(ctx.amount);

  if (offset_days < 0) {
    return {
      subject: `Heads up: ${ctx.milestone_label} due ${ctx.due_date}`,
      body:
        `Hi ${ctx.client_name ?? "there"},\n\n` +
        `Just a friendly reminder that ${ctx.milestone_label} for ${ctx.project_name} ` +
        `(${dollars}) is due ${ctx.due_date}. You can pay by check or credit card here:\n\n` +
        `${ctx.pay_url}\n\n` +
        `Thanks — Ronnie, Rose Concrete`,
    };
  }
  if (offset_days === 0) {
    return {
      subject: `Payment due today: ${ctx.milestone_label}`,
      body:
        `Hi ${ctx.client_name ?? "there"},\n\n` +
        `${ctx.milestone_label} for ${ctx.project_name} (${dollars}) is due today. ` +
        `Pay here: ${ctx.pay_url}\n\n` +
        `Thanks — Ronnie, Rose Concrete`,
    };
  }
  return {
    subject: `${offset_days} days past due: ${ctx.milestone_label}`,
    body:
      `Hi ${ctx.client_name ?? "there"},\n\n` +
      `Our records show ${ctx.milestone_label} for ${ctx.project_name} (${dollars}) ` +
      `is ${offset_days} days past due. Please pay at your earliest convenience:\n\n` +
      `${ctx.pay_url}\n\n` +
      `If something's wrong or you need a different arrangement, just reply.\n\n` +
      `Thanks — Ronnie, Rose Concrete`,
  };
}

export function buildSmsCopy(ctx: ReminderContext): string {
  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(ctx.amount);
  return (
    `Rose Concrete: ${ctx.milestone_label} for ${ctx.project_name} ` +
    `(${dollars}) is ${ctx.offset_days} day${
      ctx.offset_days === 1 ? "" : "s"
    } past due. Pay: ${ctx.pay_url}`
  );
}

/**
 * Stub senders. Both return `skip: true` so the cron marks the reminder
 * 'skipped' rather than 'failed' — no alerting storm while MCP is unwired.
 */
export function createStubSenders(): ReminderSenders {
  return {
    async sendEmail() {
      return {
        ok: false,
        error: "Gmail MCP not wired — reminder skipped.",
        skip: true,
      };
    },
    async sendSms() {
      return {
        ok: false,
        error: "OpenPhone MCP not wired — reminder skipped.",
        skip: true,
      };
    },
  };
}

/**
 * Production senders — SMS routes through the real OpenPhone REST adapter
 * when `OPENPHONE_API_KEY` is set; email routes through Resend when
 * `RESEND_API_KEY` is set. Both silently skip otherwise.
 */
import { getOpenPhoneAdapter, normalizePhone } from "@/lib/openphone";
import { getEmailAdapter } from "@/lib/email";

export function createDefaultSenders(): ReminderSenders {
  const phone = getOpenPhoneAdapter();
  const email = getEmailAdapter();
  return {
    async sendEmail(ctx) {
      if (!ctx.client_email) {
        return { ok: false, error: "No client email.", skip: true };
      }
      const copy = buildReminderCopy(ctx);
      const res = await email.send({
        to: ctx.client_email,
        subject: copy.subject,
        text: copy.body,
        tag: "reminder",
      });
      if (res.ok) return { ok: true, message_id: res.id };
      return { ok: false, error: res.error, skip: res.skip };
    },
    async sendSms(ctx) {
      const dest = normalizePhone(ctx.client_phone);
      if (!dest) {
        return { ok: false, error: "No client phone.", skip: true };
      }
      const body = buildSmsCopy(ctx);
      const res = await phone.sendMessage(dest, body);
      if (res.ok) {
        return { ok: true, message_id: res.external_id };
      }
      return { ok: false, error: res.error, skip: res.skip };
    },
  };
}
