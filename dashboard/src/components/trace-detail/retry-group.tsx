import type { TraceEvent } from "@/data/queries";
import { StepCard } from "./step-card";
import { RefreshCw, CheckCircle2 } from "lucide-react";

interface RetryGroupProps {
  events: TraceEvent[];
  firstTimestamp: number;
}

function formatTimeDiff(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`;
  return `+${(ms / 60000).toFixed(1)}m`;
}

export function RetryGroup({ events, firstTimestamp }: RetryGroupProps) {
  const earliestTime = Math.min(
    ...events.map((e) => new Date(e.eventTimestamp).getTime())
  );
  const timeDiff = earliestTime - firstTimestamp;
  const lastEvent = events[events.length - 1];
  const resolved = lastEvent?.eventStatus === "SUCCESS";

  return (
    <div className="relative">
      {/* Retry indicator */}
      <div className="relative flex items-center gap-3 mb-4">
        <div className="absolute left-0 z-10 w-8 h-8 rounded-full bg-background border-2 border-amber-500/30 flex items-center justify-center ring-4 ring-amber-500/10">
          <RefreshCw className="h-4 w-4 text-amber-500" />
        </div>
        <div className="ml-12 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Step Retry
          </span>
          {timeDiff > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {formatTimeDiff(timeDiff)}
            </span>
          )}
        </div>
      </div>

      {/* Retry branch line */}
      <div className="relative ml-[15px]">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500/20" />

        {/* Retry cards in grid */}
        <div className="ml-[33px] grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((event, index) => {
            const isFailed = event.eventStatus === "FAILURE";
            const isLastAttempt = index === events.length - 1;
            return (
              <div
                key={event.eventLogId}
                className={`relative animate-fade-in ${isFailed && !isLastAttempt ? "opacity-60" : ""}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Branch connector from main line to card */}
                <div className="absolute -left-[33px] top-8 w-[33px] h-0.5 bg-amber-500/30" />
                <div className={isFailed ? "ring-1 ring-red-500/30 rounded-xl" : ""}>
                  <StepCard
                    event={event}
                    index={event.stepSequence ?? index}
                    isLast={false}
                    compact
                    hideTimelineIndicator
                    label={`Attempt ${index + 1}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resolved indicator */}
      <div className="relative flex items-center gap-3 mt-4">
        <div className="absolute left-0 z-10 w-8 h-8 rounded-full bg-background border-2 border-amber-500/30 flex items-center justify-center ring-4 ring-amber-500/10">
          {resolved ? (
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
          ) : (
            <RefreshCw className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="ml-12">
          <span className="text-xs font-medium text-muted-foreground">
            {resolved ? "Resolved" : "Retrying"}
          </span>
        </div>
      </div>
    </div>
  );
}
