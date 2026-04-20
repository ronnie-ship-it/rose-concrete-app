import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Small primitive set mirroring the Jobber visual vocabulary:
 *   - PageHeader: title + optional subtitle + right-side actions
 *   - Card: white bg, subtle border, 1rem radius
 *   - StatusPill: rounded badge w/ color tied to status family
 *   - JobCard: the list-row pattern used on /projects and /schedule
 *   - EmptyState: consistent "nothing here yet" block
 *
 * Kept deliberately plain (Tailwind only, no deps) so the whole app can
 * share one look without dragging in a component library.
 */

// ── PageHeader ───────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-neutral-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-brand-700">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white p-5 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-100 ${className}`}
    >
      {children}
    </div>
  );
}

// ── StatusPill ───────────────────────────────────────────────────────────
const pillTones: Record<string, string> = {
  neutral:
    "bg-neutral-100 text-neutral-700 dark:bg-brand-700 dark:text-neutral-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  danger: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-700 dark:text-white",
};

/**
 * Map project/quote/milestone statuses to color families so the same pill
 * component can render any status without a local lookup.
 */
const statusTone: Record<string, keyof typeof pillTones> = {
  // projects
  lead: "neutral",
  quoting: "info",
  approved: "brand",
  scheduled: "info",
  active: "warning",
  done: "success",
  cancelled: "neutral",
  // quotes
  draft: "neutral",
  sent: "info",
  accepted: "success",
  declined: "danger",
  expired: "neutral",
  // milestones
  pending: "neutral",
  due: "warning",
  overdue: "danger",
  paid: "success",
  waived: "neutral",
  refunded: "danger",
};

export function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone?: keyof typeof pillTones;
}) {
  const resolved = tone ?? statusTone[status] ?? "neutral";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${pillTones[resolved]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── JobCard (list row) ───────────────────────────────────────────────────
export function JobCard({
  href,
  title,
  client,
  meta,
  status,
  right,
}: {
  href: string;
  title: string;
  client?: string;
  meta?: string;
  status?: string;
  right?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm dark:border-brand-700 dark:bg-brand-800 dark:hover:border-accent-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {title}
            </h3>
            {status && <StatusPill status={status} />}
          </div>
          {client && (
            <p className="mt-1 truncate text-sm text-neutral-600 dark:text-neutral-300">
              {client}
            </p>
          )}
          {meta && (
            <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {meta}
            </p>
          )}
        </div>
        {right && (
          <div className="text-right text-sm text-neutral-600 dark:text-neutral-300">
            {right}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-brand-700 dark:bg-brand-800">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// ── StatusPillLink — clickable pill nav (Jobber-style filter tabs) ──────
export function StatusPillLink({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300 hover:text-brand-700 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200 dark:hover:border-accent-500 dark:hover:text-white"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
            active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────
export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    />
  );
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-700 dark:bg-brand-800 dark:text-neutral-200 dark:hover:bg-brand-700 ${className}`}
    />
  );
}
