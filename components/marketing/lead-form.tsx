"use client";

import {
  useId,
  useState,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";
import { z } from "zod";
import { Button, buttonClassNames } from "@/components/ui/button";
import { pushEvent, trackGenerateLead } from "@/lib/marketing/analytics";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PHONE_DISPLAY,
  PHONE_TEL_HREF,
  TRUST_SIGNALS,
} from "@/lib/marketing/brand";
import { MARKETING_FORM_SERVICE_TYPES, SERVICE_LABEL } from "@/lib/service-types";

/**
 * Lead capture form — the most important component on the marketing site.
 *
 * Behavior:
 *   1. Client-side zod validation runs on submit. Field errors render
 *      inline beneath each input and flip the input's `aria-invalid`
 *      so screen readers + the input primitive both pick them up.
 *   2. On valid submit, posts JSON to /api/leads with `source` set to
 *      the current pathname (so attribution maps cleanly to the page
 *      the lead came from — see /api/leads, which prefixes "marketing/").
 *   3. While in flight, the submit button is disabled + shows a spinner.
 *      Form fields are not disabled, so the user can edit if they
 *      change their mind mid-flight, but resubmission is blocked.
 *   4. On success, replaces the form with a thanks panel that confirms
 *      what just happened ("we texted you" / "Ronnie will call you").
 *      The thanks panel does NOT show the API's lead_id — that's a UUID
 *      no homeowner needs.
 *   5. On error, shows a banner above the submit button with the call
 *      number as the escape hatch ("we couldn't save that — call us").
 *
 * Anti-spam:
 *   - Hidden honeypot input named `website`. Bots fill every field;
 *     humans never see it (visually-hidden, tab-skipped). The /api/leads
 *     endpoint silently 200s when this field is populated.
 *   - The /api/leads endpoint also enforces a (source, phone, 1h) dedupe
 *     so a frantic double-click can't double-fire OpenPhone.
 *
 * Props:
 *   - `defaultServiceType` — pre-select a value when the form is embedded
 *     on a service page (so the dropdown lands pre-filled with whatever
 *     the visitor was reading about).
 *   - `eyebrow` / `title` — let pages tune the headline ("Get a free
 *     driveway quote" vs the generic default).
 *   - `compact` — hide the headline + trust strip, useful when the form
 *     sits inside a pre-styled section (e.g. a hero panel that already
 *     has its own H2).
 */

// Validation schema — keep field names in sync with the endpoint contract.
const Schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a phone we can call.")
    .max(40)
    .refine(
      (v) => v.replace(/\D/g, "").length >= 10,
      "Please enter a 10-digit phone number.",
    ),
  email: z
    .string()
    .trim()
    .email("That doesn't look like a valid email.")
    .max(200)
    .optional()
    .or(z.literal("")),
  zip: z
    .string()
    .trim()
    .max(10)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^\d{5}(?:-\d{4})?$/.test(v),
      "Please enter a 5-digit ZIP.",
    ),
  // Optional. Helps Ronnie locate the job before the call. Not required —
  // many homeowners are uncomfortable handing over a street address before
  // they've talked to a contractor, so we don't gate the form on it.
  // Wired through to leads.service_address + clients.address by createLead.
  address: z.string().trim().max(200).optional().or(z.literal("")),
  service_type: z.string().trim().optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; firstName: string; smsConfirmed: boolean }
  | { status: "error"; message: string };

type FieldErrors = Partial<Record<keyof z.infer<typeof Schema>, string>>;

export type LeadFormProps = {
  defaultServiceType?: string;
  eyebrow?: string;
  title?: string;
  compact?: boolean;
  className?: string;
};

export function LeadForm({
  defaultServiceType = "",
  eyebrow = "Free · No obligation · 60 seconds",
  title = "Get Your Free Quote in 60 Seconds",
  compact = false,
  className,
}: LeadFormProps) {
  const formId = useId();
  const pathname = usePathname() || "/";
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.status === "submitting") return;

    const fd = new FormData(e.currentTarget);
    const raw = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      zip: String(fd.get("zip") ?? ""),
      address: String(fd.get("address") ?? ""),
      service_type: String(fd.get("service_type") ?? ""),
      message: String(fd.get("message") ?? ""),
      // Honeypot field. Submitting it (with anything) is the bot tell.
      website: String(fd.get("website") ?? ""),
    };

    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof z.infer<typeof Schema>;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      // Focus the first errored input so the user lands on what's wrong.
      const firstKey = Object.keys(fieldErrors)[0];
      if (firstKey) {
        const el = e.currentTarget.elements.namedItem(firstKey);
        if (el && "focus" in el) (el as HTMLElement).focus();
      }
      return;
    }

    setErrors({});
    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          // Pass through the honeypot — the endpoint does the silencing.
          website: raw.website,
          source: pathname,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        responded?: { sms?: boolean };
      };

      if (!res.ok || !json.ok) {
        setState({
          status: "error",
          message:
            json.error ??
            "We couldn't save your request. Please call us at the number above.",
        });
        return;
      }

      const nameParts = parsed.data.name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? "you";
      const lastName = nameParts.slice(1).join(" ") || undefined;
      setState({
        status: "success",
        firstName,
        smsConfirmed: !!json.responded?.sms,
      });
      // Fire three analytics transports in parallel:
      //   - GTM dataLayer push (`lead_submitted`) — for any tags managed
      //     in the GTM container.
      //   - GA4 `generate_lead` recommended event — direct gtag, shows
      //     up in the property's Conversions report with source_page
      //     attribution.
      //   - Google Ads conversion (if NEXT_PUBLIC_GOOGLE_ADS_ID is set
      //     in app/layout.tsx) — fires the AW- conversion event with
      //     Enhanced Conversion user data attached.
      // All three no-op safely when their respective env / tag isn't
      // loaded. None throw. None can break the form's success path.
      pushEvent({
        event: "lead_submitted",
        source_page: pathname,
        service_type: parsed.data.service_type || undefined,
        had_phone: !!parsed.data.phone,
        had_email: !!parsed.data.email,
      });
      trackGenerateLead({
        source_page: pathname,
        service_type: parsed.data.service_type || undefined,
      });
      // Google Ads conversion + Enhanced Conversions. `set user_data`
      // MUST come before the conversion event so gtag.js attaches the
      // PII (hashed client-side before transmission) to the conversion.
      // Phone is normalised to E.164 (+1XXXXXXXXXX) — the form accepts
      // any formatting, but Google rejects non-E.164 silently.
      const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
      const adsLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
      if (
        adsId &&
        adsLabel &&
        typeof window !== "undefined" &&
        typeof window.gtag === "function"
      ) {
        window.gtag("set", "user_data", {
          email: parsed.data.email || undefined,
          phone_number: toE164Us(parsed.data.phone),
          address: {
            first_name: firstName,
            last_name: lastName,
            postal_code: parsed.data.zip || undefined,
          },
        });
        window.gtag("event", "conversion", {
          send_to: `${adsId}/${adsLabel}`,
          value: 1.0,
          currency: "USD",
        });
      }
    } catch {
      setState({
        status: "error",
        message:
          "We couldn't reach our server. Please call us at the number above.",
      });
    }
  }

  if (state.status === "success") {
    return (
      <ThanksPanel
        firstName={state.firstName}
        smsConfirmed={state.smsConfirmed}
        compact={compact}
        className={className}
      />
    );
  }

  return (
    <section
      aria-labelledby={`${formId}-heading`}
      className={cnLocal(
        "rounded-xl border border-brand-100 bg-white p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      {!compact && (
        <header className="mb-5">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
              {eyebrow}
            </p>
          )}
          <h2
            id={`${formId}-heading`}
            className="mt-1 text-2xl font-extrabold text-brand-900 sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm text-brand-700/80">
            We text you a confirmation immediately. Ronnie calls back{" "}
            <span className="whitespace-nowrap">as soon as he can.</span>
          </p>
        </header>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        {/* Honeypot — visually hidden, tab-skipped. */}
        <div
          aria-hidden="true"
          className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
        >
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </label>
        </div>

        <FormRow
          id={`${formId}-name`}
          label="Name"
          required
          error={errors.name}
          className="sm:col-span-2"
        >
          <Input
            id={`${formId}-name`}
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-invalid={!!errors.name}
            placeholder="Jane Homeowner"
          />
        </FormRow>

        <FormRow
          id={`${formId}-phone`}
          label="Phone"
          required
          error={errors.phone}
        >
          <Input
            id={`${formId}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            aria-invalid={!!errors.phone}
            placeholder="(619) 555-0123"
          />
        </FormRow>

        <FormRow
          id={`${formId}-email`}
          label="Email"
          error={errors.email}
        >
          <Input
            id={`${formId}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            placeholder="you@example.com"
          />
        </FormRow>

        <FormRow id={`${formId}-zip`} label="ZIP" error={errors.zip}>
          <Input
            id={`${formId}-zip`}
            name="zip"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            aria-invalid={!!errors.zip}
            placeholder="92101"
            maxLength={10}
          />
        </FormRow>

        <FormRow
          id={`${formId}-address`}
          label="Project address"
          error={errors.address}
          className="sm:col-span-2"
        >
          <Input
            id={`${formId}-address`}
            name="address"
            type="text"
            autoComplete="street-address"
            aria-invalid={!!errors.address}
            placeholder="123 Main St (optional)"
          />
        </FormRow>

        <FormRow
          id={`${formId}-service`}
          label="Project type"
          error={errors.service_type}
        >
          <Select
            id={`${formId}-service`}
            name="service_type"
            defaultValue={defaultServiceType}
            aria-invalid={!!errors.service_type}
          >
            <option value="">— choose one —</option>
            {MARKETING_FORM_SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABEL[s]}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow
          id={`${formId}-message`}
          label="Tell us about the job"
          error={errors.message}
          className="sm:col-span-2"
        >
          <Textarea
            id={`${formId}-message`}
            name="message"
            placeholder="Approx. sq ft, condition of existing surface, anything Ronnie should know."
            aria-invalid={!!errors.message}
          />
        </FormRow>

        {state.status === "error" && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          >
            <p className="font-semibold">{state.message}</p>
            <p className="mt-1 text-red-800/80">
              Or call us directly:{" "}
              <a
                href={PHONE_TEL_HREF}
                className="font-bold text-red-900 underline"
              >
                {PHONE_DISPLAY}
              </a>
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <Button
            type="submit"
            size="xl"
            className="w-full"
            disabled={state.status === "submitting"}
          >
            {state.status === "submitting" ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              "Get My Free Quote"
            )}
          </Button>
          {!compact && (
            <p className="mt-3 text-center text-xs text-brand-700/70">
              {TRUST_SIGNALS.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

/** Tiny local cn so this component file has zero shared-state imports. */
function cnLocal(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(" ");
}

/** Best-effort US E.164 normalisation for the Google Ads Enhanced
 *  Conversions `phone_number` field. Returns `undefined` when the
 *  digit count doesn't fit a US (10) or US-with-country-code (11
 *  starting with 1) pattern, so we send nothing rather than something
 *  Google will silently reject. */
function toE164Us(input: string): string | undefined {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return undefined;
}

function FormRow({
  id,
  label,
  required,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={required} className="mb-1.5">
        {label}
      </Label>
      {children}
      {error && (
        <p className="mt-1 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThanksPanel({
  firstName,
  smsConfirmed,
  compact,
  className,
}: {
  firstName: string;
  smsConfirmed: boolean;
  compact: boolean;
  className?: string;
}) {
  return (
    <section
      role="status"
      className={cnLocal(
        "rounded-xl border border-accent-200 bg-accent-50 p-6 sm:p-8 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-500 text-white">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
        Got it, {firstName}.
      </h2>
      <p className="mt-2 text-base text-brand-800">
        {smsConfirmed
          ? "We just texted you a confirmation. Ronnie will call you within the hour."
          : "Ronnie will call you within the hour. If you don't hear from us, call (619) 537-9408."}
      </p>
      {!compact && (
        <p className="mt-4 text-sm text-brand-700/80">
          Need to add a detail? Just reply to the text or email — it goes
          straight to Ronnie.
        </p>
      )}
      <div className="mt-6">
        <a
          href={PHONE_TEL_HREF}
          className={buttonClassNames({ variant: "accent", size: "lg" })}
        >
          Call {PHONE_DISPLAY} now
        </a>
      </div>
    </section>
  );
}
