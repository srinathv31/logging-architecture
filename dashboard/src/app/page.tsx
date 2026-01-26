import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { searchParamsCache } from "@/lib/search-params";
import { TraceFilters } from "@/components/traces/trace-filters";
import { TraceTableServer } from "@/components/traces/trace-table-server";
import { TraceTableSkeleton } from "@/components/traces/trace-table-skeleton";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParamsCache.parse(await searchParams);

  const filterHash = JSON.stringify(params);

  return (
    <NuqsAdapter>
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Log Dashboard</h1>
          <p className="text-muted-foreground">
            Browse and filter distributed traces across your systems.
          </p>
        </div>

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
    </NuqsAdapter>
  );
}
