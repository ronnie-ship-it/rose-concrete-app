"use client";

import { useActionState } from "react";
import { saveJobberCredentialsAction } from "./actions";

/**
 * Credentials entry form. On submit the server action writes the
 * client_id + client_secret + a fresh CSRF state to the singleton row,
 * then redirects Ronnie to Jobber's authorize URL. He comes back to the
 * parent page through the callback route.
 */
export function CredentialsForm({
  redirectUri,
}: {
  redirectUri: string;
}) {
  const [state, formAction, pending] = useActionState<
    { ok: false; error: string } | null,
    FormData
  >(saveJobberCredentialsAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Client ID
        </label>
        <input
          type="text"
          name="client_id"
          required
          autoComplete="off"
          placeholder="From Jobber → Developer Center → your app"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Client secret
        </label>
        <input
          type="password"
          name="client_secret"
          required
          autoComplete="off"
          placeholder="Treat like a password — never commit or share"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="rounded-md bg-cream px-3 py-2 text-xs text-neutral-700">
        <p className="font-semibold text-brand-700">Redirect URI</p>
        <p className="mt-1">
          Add this exact URL to your Jobber app&apos;s allowed redirect
          URIs before submitting:
        </p>
        <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-[11px] text-neutral-900">
          {redirectUri}
        </code>
      </div>

      {state && state.ok === false && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Redirecting to Jobber…" : "Connect to Jobber"}
      </button>

      <p className="text-[11px] text-neutral-500">
        You&apos;ll be sent to Jobber to authorize this app. After
        approving, Jobber will send you back here with an access token
        we&apos;ll use for the import.
      </p>
    </form>
  );
}
