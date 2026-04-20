"use client";

import { useActionState } from "react";
import { tenantSignupAction, type SignupResult } from "./actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<
    SignupResult | null,
    FormData
  >(tenantSignupAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-4xl">✓</p>
        <h2 className="text-lg font-semibold text-neutral-900">
          {state.newTenant
            ? "Workspace created — check your email"
            : "Magic link sent — check your email"}
        </h2>
        <p className="text-sm text-neutral-600">
          We sent a sign-in link to <strong>{state.email}</strong>. Click
          it to finish {state.newTenant ? "setting up" : "signing in to"}{" "}
          your account.
        </p>
        <p className="text-xs text-neutral-500">
          Didn&apos;t see it? Check spam. Links expire after an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Company name
        </label>
        <input
          type="text"
          name="company_name"
          required
          minLength={2}
          maxLength={120}
          placeholder="e.g. Bay Area Concrete Co."
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-3 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="mt-1 text-[11px] text-neutral-500">
          This is what shows on your quotes, invoices, and customer
          hub. You can change it later.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Your email
        </label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@yourcompany.com"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-3 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Creating workspace…" : "Create my workspace"}
      </button>
    </form>
  );
}
