"use client";

/**
 * Change-password form. Two password fields (new + confirm), submit
 * button. Uses `useActionState` so the server-side error or success
 * lands inline with the form.
 *
 * Show / Hide toggle on the password input — easier to fix typos on
 * a phone where you can't see what you typed.
 */
import { useActionState, useState } from "react";
import { changePasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    null,
  );
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          New password
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            className="block w-full rounded-md border border-neutral-300 px-3 py-2 pr-12 text-sm shadow-sm focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-bold text-[#1A7B40]"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          At least 8 characters.
        </p>
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-[#1A7B40] focus:outline-none focus:ring-1 focus:ring-[#1A7B40] dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        />
      </div>
      {state?.ok === false && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-md bg-[#1A7B40]/10 px-3 py-2 text-sm font-medium text-[#1A7B40]">
          Password updated. Use the Password tab on the login screen next time
          you sign in.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center rounded-md bg-[#1A7B40] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
