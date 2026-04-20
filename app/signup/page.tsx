import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Get started — Rose Concrete app" };

/**
 * Tenant signup page. Each contractor signs up with their company
 * name and email; the backend creates a fresh tenant and promotes
 * them to admin of it. Data is isolated per-tenant by Postgres RLS.
 */
export default function SignupPage() {
  return (
    <div className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Rose Concrete ops platform
          </p>
          <h1 className="text-3xl font-bold text-neutral-900">
            Start your 14-day trial
          </h1>
          <p className="text-sm text-neutral-600">
            Quotes, scheduling, crew photos, cash journal, and
            QuickBooks invoicing — built for concrete contractors.
          </p>
        </header>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <SignupForm />
        </div>

        <div className="rounded-lg border border-neutral-100 bg-white/60 p-4 text-xs text-neutral-600">
          <p className="font-semibold text-neutral-700">
            Already have an account?
          </p>
          <p className="mt-1">
            <Link href="/login" className="text-brand-700 underline">
              Sign in with your email
            </Link>{" "}
            — we&apos;ll text or email you a magic link.
          </p>
        </div>

        <ul className="rounded-lg border border-neutral-100 bg-white/60 p-4 text-xs text-neutral-600">
          <li className="font-semibold text-neutral-700">Included:</li>
          <li className="mt-2">✓ Multi-phase job scheduling (demo → pour → cleanup)</li>
          <li>✓ Auto-draft SMS to crew via OpenPhone</li>
          <li>✓ Customer-facing forms + digital signatures</li>
          <li>✓ Daily photo compliance reminders</li>
          <li>✓ Cash journal for day laborers</li>
          <li>✓ QuickBooks invoicing with card / ACH / check options</li>
          <li>✓ Crew app (iOS + Android via PWA)</li>
          <li>✓ English + Spanish for crew</li>
        </ul>

        <p className="text-center text-[11px] text-neutral-500">
          By signing up you agree to our terms of service. No credit
          card required to start.
        </p>
      </div>
    </div>
  );
}
