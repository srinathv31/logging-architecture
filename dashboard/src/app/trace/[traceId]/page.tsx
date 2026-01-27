import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTraceDetail } from "@/data/queries";
import { TraceHeader } from "@/components/trace-detail/trace-header";
import { TraceTimeline } from "@/components/trace-detail/trace-timeline";
import { TraceDetailSkeleton } from "@/components/trace-detail/trace-detail-skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

async function TraceContent({ traceId }: { traceId: string }) {
  const detail = await getTraceDetail(traceId);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
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
    <div className="min-h-screen bg-gradient-to-b from-accent/30 via-background to-background">
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2 gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to traces
          </Button>
        </Link>
      </div>

      <Suspense fallback={<TraceDetailSkeleton />}>
        <TraceContent traceId={decodedTraceId} />
      </Suspense>
    </div>
    </div>
  );
}
