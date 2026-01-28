import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { searchParamsCache } from "@/lib/search-params";
import { TraceFilters } from "@/components/traces/trace-filters";
import { TraceTableServer } from "@/components/traces/trace-table-server";
import { TraceTableSkeleton } from "@/components/traces/trace-table-skeleton";
import { DashboardStats } from "@/components/layout/dashboard-stats";
import { Skeleton } from "@/components/ui/skeleton";

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParamsCache.parse(await searchParams);

  const filterHash = JSON.stringify(params);

  return (
    <NuqsAdapter>
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Event Log Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            End-to-end visibility into customer journeys across all systems.
          </p>
        </div>

        {/* Stats Section */}
        <Suspense fallback={<StatsSkeleton />}>
          <DashboardStats />
        </Suspense>

        {/* Filters and Table Section */}
        <div className="space-y-4">
          <TraceFilters />

          <Suspense key={filterHash} fallback={<TraceTableSkeleton />}>
            <TraceTableServer
              filters={{
                processName: params.processName || undefined,
                batchId: params.batchId || undefined,
                accountId: params.accountId || undefined,
                eventStatus: params.eventStatus || undefined,
                page: params.page,
              }}
            />
          </Suspense>
        </div>
      </div>
    </NuqsAdapter>
  );
}
