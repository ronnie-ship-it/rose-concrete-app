import { SkeletonLine, SkeletonCard } from "@/components/skeletons";

/** Crew Today skeleton — tall cards matching the rendered layout. */
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SkeletonLine width="w-24" className="h-6" />
        <SkeletonLine width="w-40" className="h-3" />
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
