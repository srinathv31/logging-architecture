"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PayloadViewer } from "./payload-viewer";
import { STATUS_COLORS, EVENT_TYPE_COLORS } from "@/lib/constants";
import type { TraceEvent } from "@/data/queries";

interface StepDetailSheetProps {
  event: TraceEvent;
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-mono text-right break-all">{String(value)}</span>
    </div>
  );
}

export function StepDetailSheet({ event }: StepDetailSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          View Details
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-left">
            {event.stepName ?? event.processName}
          </SheetTitle>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="secondary"
              className={EVENT_TYPE_COLORS[event.eventType] ?? ""}
            >
              {event.eventType}
            </Badge>
            <Badge
              variant="secondary"
              className={STATUS_COLORS[event.eventStatus] ?? ""}
            >
              {event.eventStatus}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] pr-4 mt-4">
          <div className="space-y-6">
            {/* Identifiers */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Identifiers</h3>
              <div className="space-y-0.5">
                <DetailRow label="Execution ID" value={event.executionId} />
                <DetailRow label="Correlation ID" value={event.correlationId} />
                <DetailRow label="Trace ID" value={event.traceId} />
                <DetailRow label="Span ID" value={event.spanId} />
                <DetailRow label="Parent Span ID" value={event.parentSpanId} />
                <DetailRow label="Batch ID" value={event.batchId} />
                <DetailRow label="Account ID" value={event.accountId} />
              </div>
            </div>

            <Separator />

            {/* System Context */}
            <div>
              <h3 className="text-sm font-semibold mb-2">System Context</h3>
              <div className="space-y-0.5">
                <DetailRow label="Application ID" value={event.applicationId} />
                <DetailRow label="Target System" value={event.targetSystem} />
                <DetailRow label="Originating System" value={event.originatingSystem} />
              </div>
            </div>

            <Separator />

            {/* Process Details */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Process Details</h3>
              <div className="space-y-0.5">
                <DetailRow label="Process Name" value={event.processName} />
                <DetailRow label="Step Sequence" value={event.stepSequence} />
                <DetailRow label="Step Name" value={event.stepName} />
                <DetailRow label="Event Type" value={event.eventType} />
                <DetailRow label="Event Status" value={event.eventStatus} />
                <DetailRow label="Summary" value={event.summary} />
                <DetailRow label="Result" value={event.result} />
              </div>
            </div>

            <Separator />

            {/* Timing */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Timing</h3>
              <div className="space-y-0.5">
                <DetailRow label="Event Timestamp" value={event.eventTimestamp} />
                <DetailRow label="Created At" value={event.createdAt} />
                <DetailRow label="Execution Time" value={event.executionTimeMs !== null ? `${event.executionTimeMs}ms` : null} />
              </div>
            </div>

            {/* HTTP Details */}
            {(event.endpoint || event.httpMethod || event.httpStatusCode) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2">HTTP Details</h3>
                  <div className="space-y-0.5">
                    <DetailRow label="Method" value={event.httpMethod} />
                    <DetailRow label="Endpoint" value={event.endpoint} />
                    <DetailRow label="Status Code" value={event.httpStatusCode} />
                  </div>
                </div>
              </>
            )}

            {/* Error Details */}
            {(event.errorCode || event.errorMessage) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2">Error Details</h3>
                  <div className="space-y-0.5">
                    <DetailRow label="Error Code" value={event.errorCode} />
                    <DetailRow label="Error Message" value={event.errorMessage} />
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Business Data */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Business Identifiers</h3>
              <PayloadViewer
                content={event.identifiers ? JSON.stringify(event.identifiers) : null}
                label="Identifiers"
              />
            </div>

            {event.metadata != null ? (
              <PayloadViewer
                content={JSON.stringify(event.metadata)}
                label="Metadata"
              />
            ) : null}

            <Separator />

            {/* Payloads */}
            <PayloadViewer content={event.requestPayload} label="Request Payload" />
            <PayloadViewer content={event.responsePayload} label="Response Payload" />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
