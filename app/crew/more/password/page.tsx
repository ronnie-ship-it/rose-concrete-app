import { requireUser } from "@/lib/auth";
import { CrewCreateChrome } from "../../create/chrome";
import { ChangePasswordForm } from "./form";

export const metadata = { title: "Change password — Rose Concrete" };

/**
 * Crew "Change password" — reachable from the More menu. Wraps a
 * client form that calls `auth.updateUser({ password })`. Once the
 * password is set, the user can log in via email + password on
 * `/login` instead of waiting for a magic-link email.
 */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  return (
    <CrewCreateChrome title="Change password" saveLabel="Done" saveHref="/crew/more">
      <div className="px-4 pt-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Signed in as{" "}
          <span className="font-bold text-[#1a2332] dark:text-white">
            {user.full_name ?? user.email}
          </span>
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Once you set a password, sign in faster on the{" "}
          <span className="font-bold">Password</span> tab of the login screen
          instead of waiting for a magic link.
        </p>
      </div>
      <div className="px-4 pt-6">
        <ChangePasswordForm />
      </div>
    </CrewCreateChrome>
  );
}
