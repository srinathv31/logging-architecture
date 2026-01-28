import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTraceDetail } from "@/data/queries";
import { TraceHeader } from "@/components/trace-detail/trace-header";
import { TraceTimeline } from "@/components/trace-detail/trace-timeline";
import { TraceDetailSkeleton } from "@/components/trace-detail/trace-detail-skeleton";

async function TraceContent({ traceId }: { traceId: string }) {
  const detail = await getTraceDetail(traceId);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <TraceHeader traceId={traceId} detail={detail} />
      <TraceTimeline events={detail.events} />
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
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<TraceDetailSkeleton />}>
        <TraceContent traceId={decodedTraceId} />
      </Suspense>
    </div>
  );
}
