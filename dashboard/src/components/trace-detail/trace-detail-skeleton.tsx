import { Skeleton } from "@/components/ui/skeleton";

export function TraceDetailSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="rounded-xl border bg-card shadow-sm p-6 space-y-6">
        {/* Title and metrics row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-7 w-36" />
            </div>
            <Skeleton className="h-6 w-64" />
          </div>
          <div className="flex items-center gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-8 w-12 mx-auto" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* 4-column status grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-6" />
              </div>
            </div>
          ))}
        </div>

        {/* Systems badges */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Systems flow skeleton */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="h-20 w-24 rounded-lg" />
              {i < 3 && <Skeleton className="h-0.5 w-12 mx-2" />}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="relative">
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-border" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative pb-6">
              <Skeleton className="absolute left-0 top-4 h-8 w-8 rounded-full z-10" />
              <div className="ml-12">
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full ml-auto" />
                  </div>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
