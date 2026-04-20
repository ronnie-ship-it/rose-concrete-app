import {
  SkeletonPageHeader,
  SkeletonTable,
  SkeletonLine,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-brand-700 dark:bg-brand-800">
        <SkeletonLine width="w-40" />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
