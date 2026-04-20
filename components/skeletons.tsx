/**
 * Loading-skeleton primitives. Next.js shows an `app/<route>/loading.tsx`
 * file while the server component fetches data — these components are
 * the building blocks.
 *
 *   <SkeletonLine />      — single-line gray bar (for a heading)
 *   <SkeletonBlock />     — multi-line rectangle (body paragraph)
 *   <SkeletonCard />      — full list-row card with title + meta
 *   <SkeletonList rows /> — stacked <SkeletonCard>s
 *   <SkeletonTable />     — five-row bare table
 *
 * All use `animate-pulse` + dark-mode-aware surface colors so they
 * feel native on both themes.
 */
export function SkeletonLine({
  className = "",
  width = "w-40",
}: {
  className?: string;
  width?: string;
}) {
  return (
    <div
      className={`h-4 animate-pulse rounded bg-neutral-200 dark:bg-brand-700 ${width} ${className}`}
    />
  );
}

export function SkeletonBlock({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-brand-700 dark:bg-brand-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <SkeletonLine width="w-1/3" />
          <SkeletonLine width="w-1/2" />
          <SkeletonLine width="w-1/4" className="h-3" />
        </div>
        <div className="h-8 w-16 animate-pulse rounded-full bg-neutral-100 dark:bg-brand-700" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-0 dark:border-brand-700 dark:bg-brand-800">
      <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 dark:border-brand-700 dark:bg-brand-900">
        <div className="flex gap-4">
          <SkeletonLine width="w-20" className="h-3" />
          <SkeletonLine width="w-24" className="h-3" />
          <SkeletonLine width="w-16" className="h-3" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-neutral-100 px-3 py-3 last:border-0 dark:border-brand-700"
        >
          <div className="flex gap-4">
            <SkeletonLine width="w-28" />
            <SkeletonLine width="w-36" />
            <SkeletonLine width="w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Page-header + subtitle skeleton. Wraps a SkeletonLine pair to
 *  match <PageHeader>'s visual weight. */
export function SkeletonPageHeader() {
  return (
    <div className="mb-6 space-y-2 border-b border-neutral-200 pb-5 dark:border-brand-700">
      <SkeletonLine width="w-48" className="h-6" />
      <SkeletonLine width="w-80" className="h-3" />
    </div>
  );
}
