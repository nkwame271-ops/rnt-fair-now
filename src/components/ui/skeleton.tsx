import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/**
 * SkeletonCard — mirrors a list-row card layout
 * Shows: avatar/icon, two text lines, badge.
 */
function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full shrink-0" />
    </div>
  );
}

/**
 * SkeletonCardList — N stacked SkeletonCard rows.
 */
function SkeletonCardList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * SkeletonStatGrid — placeholder for dashboard metric tiles.
 */
function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonCardList, SkeletonStatGrid };
