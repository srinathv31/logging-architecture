import type { TraceEvent } from "@/data/queries";
import { Badge } from "@/components/ui/badge";
import { StepCard } from "./step-card";
import { SystemsFlow } from "./systems-flow";
import { Clock } from "lucide-react";

interface TraceTimelineProps {
  events: TraceEvent[];
}

function formatTimeDiff(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`;
  return `+${(ms / 60000).toFixed(1)}m`;
}

export function TraceTimeline({ events }: TraceTimelineProps) {
  // Calculate time differences between events
  const eventTimestamps = events.map(e => new Date(e.eventTimestamp).getTime());
  const firstTimestamp = eventTimestamps.length > 0 ? Math.min(...eventTimestamps) : 0;

  return (
    <div className="space-y-6">
      {/* Systems Flow Diagram */}
      <SystemsFlow events={events} />

      {/* Timeline Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Event Timeline</h2>
            <Badge variant="secondary" className="text-xs font-medium">
              {events.length} events
            </Badge>
          </div>
        </div>

        {/* Timeline with gradient line */}
        <div className="relative">
          {/* Gradient timeline line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-border" />
          
          {events.map((event, index) => {
            const eventTime = new Date(event.eventTimestamp).getTime();
            const timeDiff = eventTime - firstTimestamp;

            return (
              <div
                key={event.eventLogId}
                className={`relative ${index === events.length - 1 ? "pb-0" : "pb-6"}`}
              >
                <StepCard
                  event={event}
                  index={index}
                  isLast={index === events.length - 1}
                  timeDiff={index > 0 ? formatTimeDiff(timeDiff) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
