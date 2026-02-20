import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTraceDetail } from "@/data/queries";
import { TraceHeader } from "@/components/trace-detail/trace-header";
import { TraceTimeline } from "@/components/trace-detail/trace-timeline";
import { JourneyNarrative } from "@/components/trace-detail/journey-narrative";
import { DurationBreakdown } from "@/components/trace-detail/duration-breakdown";
import { TraceDetailSkeleton } from "@/components/trace-detail/trace-detail-skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { TraceDetailError } from "./trace-detail-error";
import { detectAttempts } from "@/lib/span-tree";

async function TraceContent({ traceId }: { traceId: string }) {
  const detail = await getTraceDetail(traceId);

  if (!detail) {
    notFound();
  }

  const retryInfo = detectAttempts(detail.events);

  return (
    <div className="space-y-6">
      <TraceHeader traceId={traceId} detail={detail} retryInfo={retryInfo} />
      <JourneyNarrative traceId={traceId} detail={detail} retryInfo={retryInfo} />
      <DurationBreakdown events={detail.events} />
      <TraceTimeline events={detail.events} retryInfo={retryInfo} />
    </div>
  );
}

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = await params;
  const decodedTraceId = decodeURIComponent(traceId);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <ErrorBoundary fallback={<TraceDetailError />}>
        <Suspense fallback={<TraceDetailSkeleton />}>
          <TraceContent traceId={decodedTraceId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
