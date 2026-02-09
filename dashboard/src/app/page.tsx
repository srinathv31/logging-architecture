import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { searchParamsCache } from "@/lib/search-params";
import { TraceFilters } from "@/components/traces/trace-filters";
import { TraceTableServer } from "@/components/traces/trace-table-server";
import { TraceTableSkeleton } from "@/components/traces/trace-table-skeleton";
import { TraceTableError } from "@/components/traces/trace-table-error";
import { DashboardStats } from "@/components/layout/dashboard-stats";
import { ErrorBoundary } from "@/components/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Server, Network, Eye } from "lucide-react";

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
        <div className="relative overflow-hidden rounded-2xl border bg-card p-8 shadow-sm animate-fade-in">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/10 pointer-events-none" />

          {/* Decorative SVG - interconnected systems visual */}
          <div className="absolute top-4 right-4 opacity-20 dark:opacity-10">
            <svg width="120" height="120" viewBox="0 0 120 120" className="text-emerald-500">
              <circle cx="20" cy="60" r="8" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0ms' }} />
              <circle cx="60" cy="20" r="8" fill="currentColor" className="animate-pulse" style={{ animationDelay: '200ms' }} />
              <circle cx="100" cy="60" r="8" fill="currentColor" className="animate-pulse" style={{ animationDelay: '400ms' }} />
              <circle cx="60" cy="100" r="8" fill="currentColor" className="animate-pulse" style={{ animationDelay: '600ms' }} />
              <circle cx="60" cy="60" r="12" fill="currentColor" />
              <line x1="28" y1="60" x2="48" y2="60" stroke="currentColor" strokeWidth="2" className="flow-line-animated" />
              <line x1="72" y1="60" x2="92" y2="60" stroke="currentColor" strokeWidth="2" className="flow-line-animated" />
              <line x1="60" y1="28" x2="60" y2="48" stroke="currentColor" strokeWidth="2" className="flow-line-animated" />
              <line x1="60" y1="72" x2="60" y2="92" stroke="currentColor" strokeWidth="2" className="flow-line-animated" />
            </svg>
          </div>

          <div className="relative space-y-4">
            {/* Badge */}
            <div className="flex items-center gap-2 animate-fade-in animate-stagger-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                <Activity className="h-3 w-3" />
                Enterprise Integration Platform
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-2 animate-fade-in animate-stagger-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Complete Visibility Into
                <span className="block text-emerald-600">Every Customer Journey</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                One unified API that tracks interactions across <strong className="text-foreground">all your enterprise systems</strong>.
                See exactly what happened, when, and where — in real time.
              </p>
            </div>

            {/* Value pills */}
            <div className="flex flex-wrap items-center gap-3 pt-2 animate-fade-in animate-stagger-3">
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
                <Server className="h-4 w-4 text-emerald-500" />
                <span>Multi-System Tracing</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
                <Network className="h-4 w-4 text-emerald-500" />
                <span>Journey Correlation</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
                <Eye className="h-4 w-4 text-emerald-500" />
                <span>Real-Time Insights</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <ErrorBoundary fallback={null}>
          <Suspense fallback={<StatsSkeleton />}>
            <DashboardStats />
          </Suspense>
        </ErrorBoundary>

        {/* Filters and Table Section */}
        <div className="space-y-4">
          <TraceFilters />

          <ErrorBoundary fallback={<TraceTableError />}>
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
          </ErrorBoundary>
        </div>
      </div>
    </NuqsAdapter>
  );
}
