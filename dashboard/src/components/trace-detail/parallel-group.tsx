import type { TraceEvent } from "@/data/queries";
import { StepCard } from "./step-card";
import { GitBranch, GitMerge } from "lucide-react";

interface ParallelGroupProps {
  events: TraceEvent[];
  firstTimestamp: number;
}

function formatTimeDiff(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`;
  return `+${(ms / 60000).toFixed(1)}m`;
}

export function ParallelGroup({ events, firstTimestamp }: ParallelGroupProps) {
  const earliestTime = Math.min(
    ...events.map((e) => new Date(e.eventTimestamp).getTime())
  );
  const timeDiff = earliestTime - firstTimestamp;

  return (
    <div className="relative">
      {/* Fork indicator */}
      <div className="relative flex items-center gap-3 mb-4">
        <div className="absolute left-0 z-10 w-8 h-8 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center ring-4 ring-primary/10">
          <GitBranch className="h-4 w-4 text-primary" />
        </div>
        <div className="ml-12 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Parallel Execution
          </span>
          {timeDiff > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {formatTimeDiff(timeDiff)}
            </span>
          )}
        </div>
      </div>

      {/* Fork connector lines */}
      <div className="relative ml-[15px]">
        {/* Vertical branch line on the left */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/20" />

        {/* Parallel cards in grid */}
        <div className="ml-[33px] grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((event, index) => (
            <div key={event.eventLogId} className="relative animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              {/* Branch connector from main line to card */}
              <div className="absolute -left-[33px] top-8 w-[33px] h-0.5 fork-connector" />
              <StepCard
                event={event}
                index={event.stepSequence ?? index}
                isLast={false}
                compact
                hideTimelineIndicator
              />
            </div>
          ))}
        </div>
      </div>

      {/* Join indicator */}
      <div className="relative flex items-center gap-3 mt-4">
        <div className="absolute left-0 z-10 w-8 h-8 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center ring-4 ring-primary/10">
          <GitMerge className="h-4 w-4 text-primary" />
        </div>
        <div className="ml-12">
          <span className="text-xs font-medium text-muted-foreground">
            Synchronized
          </span>
        </div>
      </div>
    </div>
  );
}
