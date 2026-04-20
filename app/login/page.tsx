import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, landingPathForRole } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — Rose Concrete",
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(landingPathForRole(user.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-brand-600">Rose Concrete</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Sign in with a one-time magic link.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-neutral-600">
          New here?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand-700 underline"
          >
            Create a workspace for your company
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
