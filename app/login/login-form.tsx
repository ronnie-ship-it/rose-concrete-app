"use client";

import { useActionState, useState, useTransition } from "react";
import { sendMagicLink, devLogin } from "./actions";

const isDev = process.env.NODE_ENV === "development";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, null);
  const [devPending, startDevTransition] = useTransition();
  const [devError, setDevError] = useState<string | null>(null);

  function handleDevLogin() {
    setDevError(null);
    startDevTransition(async () => {
      // devLogin() writes the Supabase session cookie, then returns.
      // We intentionally do NOT use router.push() — that's a soft navigation
      // and the RSC prefetch for /dashboard can race the Set-Cookie commit,
      // landing us on an unauthed render. window.location.assign() forces a
      // full-page GET that sends the fresh cookie on the first hop.
      const result = await devLogin();
      if (!result.ok) {
        setDevError(result.error);
        return;
      }
      window.location.assign("/dashboard");
    });
  }

  if (state?.ok) {
    return (
      <div className="space-y-3 text-sm text-neutral-700">
        <p className="font-medium text-neutral-900">Check your email.</p>
        <p>
          We sent a sign-in link to <strong>{state.email}</strong>. Open it on
          this device to finish signing in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-neutral-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@roseconcrete.com"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {state?.ok === false && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
      {isDev && (
        <>
          <button
            type="button"
            onClick={handleDevLogin}
            disabled={devPending}
            className="w-full rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
          >
            {devPending ? "Signing in…" : "⚡ Dev Login (localhost only)"}
          </button>
          {devError && (
            <p className="text-sm text-red-600">{devError}</p>
          )}
        </>
      )}
    </form>
  );
}
