import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_DOT_COLORS, EVENT_TYPE_COLORS } from "@/lib/constants";
import type { TraceEvent } from "@/data/queries";
import { format } from "date-fns";
import { StepDetailSheet } from "./step-detail-sheet";

interface StepCardProps {
  event: TraceEvent;
  index: number;
  isLast: boolean;
}

export function StepCard({ event, index, isLast }: StepCardProps) {
  const dotColor = STATUS_DOT_COLORS[event.eventStatus] ?? "bg-gray-400";

  return (
    <div className="relative flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`mt-1.5 h-3 w-3 rounded-full ${dotColor} ring-2 ring-background z-10 shrink-0`} />
        {!isLast && (
          <div className="w-px flex-1 bg-border" />
        )}
      </div>

      {/* Content */}
      <div className="pb-8 flex-1 min-w-0">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              #{event.stepSequence ?? index + 1}
            </span>
            <span className="font-medium text-sm">
              {event.stepName ?? event.processName}
            </span>
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

          {/* Details row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {format(new Date(event.eventTimestamp), "MMM d, yyyy HH:mm:ss.SSS")}
            </span>
            {event.executionTimeMs !== null && (
              <span>{event.executionTimeMs}ms</span>
            )}
            {event.spanId && (
              <span className="font-mono">span: {event.spanId}</span>
            )}
          </div>

          {/* Summary */}
          <p className="text-sm">{event.summary}</p>

          {/* Error details */}
          {event.errorMessage && (
            <div className="rounded bg-red-50 dark:bg-red-950 p-3 text-sm">
              <p className="font-medium text-red-800 dark:text-red-200">
                {event.errorCode && (
                  <span className="font-mono">[{event.errorCode}] </span>
                )}
                {event.errorMessage}
              </p>
            </div>
          )}

          {/* View Details */}
          <StepDetailSheet event={event} />
        </div>
      </div>
    </div>
  );
}
