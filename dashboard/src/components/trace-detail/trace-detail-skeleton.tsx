import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TraceDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-px w-full" />
          <div className="flex gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="w-px flex-1" />
          </div>
          <div className="flex-1 pb-8">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
