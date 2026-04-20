import { SkeletonPageHeader, SkeletonList } from "@/components/skeletons";

/** Loading state for /dashboard/projects — shown while the server
 *  component fetches the list. Matches the rendered layout so users
 *  don't see a layout shift when the data arrives. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonList rows={6} />
    </div>
  );
}
