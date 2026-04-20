import { SkeletonPageHeader, SkeletonList } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonList rows={8} />
    </div>
  );
}
