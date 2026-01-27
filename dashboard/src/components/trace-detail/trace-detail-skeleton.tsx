import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TraceDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <Card className="border-t-4 border-t-primary">
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          {/* 4-column status grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-7 w-8" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <div className="relative before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-px before:bg-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <Skeleton className="mt-1.5 h-6 w-6 rounded-full z-10" />
              </div>
              <div className="flex-1 pb-8">
                <div className="rounded-lg border border-l-4 p-5 space-y-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-56" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
