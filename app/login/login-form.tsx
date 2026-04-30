"use client";

/**
 * Login form — supports two paths:
 *
 *   1. Email + password (primary). Faster every day, no email round-trip,
 *      no magic-link rate limits during the morning rush.
 *   2. Magic link (secondary). Shown beneath the password form for users
 *      who haven't set a password yet, or who prefer the email link flow.
 *
 * Tabs: a small toggle at the top lets the user switch between
 * "Password" and "Magic link" without losing the email they typed —
 * we lift the email value into local state so it survives the toggle.
 *
 * Dev-mode bypass: in development, an extra "⚡ Dev Login (localhost
 * only)" button appears at the bottom for instant admin sign-in.
 */
import { useActionState, useState, useTransition } from "react";
import {
  sendMagicLink,
  signInWithPasswordAction,
  devLogin,
} from "./actions";

const isDev = process.env.NODE_ENV === "development";

type Mode = "password" | "magic";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-4">
      <ModeToggle mode={mode} onChange={setMode} />
      {mode === "password" ? (
        <PasswordPanel email={email} setEmail={setEmail} />
      ) : (
        <MagicPanel email={email} setEmail={setEmail} />
      )}
      {isDev && <DevLoginButton />}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sign-in method"
      className="grid grid-cols-2 gap-0 rounded-full bg-neutral-100 p-1 text-sm font-bold"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "password"}
        onClick={() => onChange("password")}
        className={`rounded-full px-3 py-2 transition ${
          mode === "password"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-500"
        }`}
      >
        Password
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "magic"}
        onClick={() => onChange("magic")}
        className={`rounded-full px-3 py-2 transition ${
          mode === "magic"
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-500"
        }`}
      >
        Magic link
      </button>
    </div>
  );
}

function PasswordPanel({
  email,
  setEmail,
}: {
  email: string;
  setEmail: (v: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    signInWithPasswordAction,
    null,
  );

  // On `state.ok`, the Supabase session cookie has been written. Force
  // a full-page navigation so the cookie travels on the navigation
  // request — useEffect-driven router.push() races the cookie commit.
  if (state?.ok) {
    if (typeof window !== "undefined") {
      window.location.assign("/dashboard");
    }
    return (
      <p className="text-sm text-neutral-700">Signed in. Redirecting…</p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="email-pw"
          className="block text-sm font-medium text-neutral-700"
        >
          Email
        </label>
        <input
          id="email-pw"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@roseconcrete.com"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-neutral-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function MagicPanel({
  email,
  setEmail,
}: {
  email: string;
  setEmail: (v: string) => void;
}) {
  const [state, formAction, pending] = useActionState(sendMagicLink, null);

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
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="email-magic"
          className="block text-sm font-medium text-neutral-700"
        >
          Email
        </label>
        <input
          id="email-magic"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      <p className="text-center text-xs text-neutral-500">
        We&apos;ll email you a one-time link.  No password needed.
      </p>
    </form>
  );
}

function DevLoginButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function go() {
    setError(null);
    start(async () => {
      const result = await devLogin();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.assign("/dashboard");
    });
  }
  return (
    <div className="space-y-1 border-t border-neutral-200 pt-3">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="w-full rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "⚡ Dev Login (localhost only)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
