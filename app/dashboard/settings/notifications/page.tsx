import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PushEnroll } from "@/components/push-enroll";
import { TestPushButton } from "./test-push-button";
import { isPushConfigured } from "@/lib/push";

export const metadata = { title: "Notifications — Rose Concrete" };

/**
 * Personal notification settings. Hosts the browser push enrollment
 * widget + a test-send button. Will grow to include per-event opt-ins
 * and quiet hours once the usage patterns settle.
 */
export default async function NotificationsSettingsPage() {
  await requireRole(["admin", "office"]);
  const configured = isPushConfigured();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Turn on push notifications so new leads, approved quotes, and crew check-ins reach you even when the dashboard isn't open."
      />
      <PushEnroll />

      {configured ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-brand-700 dark:bg-brand-800">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Test delivery
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
            Click to fire a notification to every browser you&apos;ve
            enrolled. If the banner doesn&apos;t pop, check the browser
            permission and that the service worker is installed.
          </p>
          <div className="mt-3">
            <TestPushButton />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-semibold">VAPID keys aren&apos;t set yet.</p>
          <p className="mt-1">
            Subscriptions get collected now and the service worker is
            installed — the server-side send flips on as soon as these
            env vars land in <code>.env.local</code>:
          </p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5">
            <li>
              <code>npx web-push generate-vapid-keys</code>
            </li>
            <li>
              Copy public → <code>VAPID_PUBLIC_KEY</code> and{" "}
              <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>
            </li>
            <li>
              Copy private → <code>VAPID_PRIVATE_KEY</code>
            </li>
            <li>
              Set <code>VAPID_SUBJECT</code>=
              <code>mailto:ronnie@sandiegoconcrete.ai</code>
            </li>
            <li>Restart the app.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
