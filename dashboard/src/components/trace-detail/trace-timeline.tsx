import type { TraceEvent } from "@/data/queries";
import { Badge } from "@/components/ui/badge";
import { StepCard } from "./step-card";

interface TraceTimelineProps {
  events: TraceEvent[];
}

export function TraceTimeline({ events }: TraceTimelineProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Timeline</h2>
        <Badge variant="secondary" className="text-xs">
          {events.length}
        </Badge>
      </div>
      <div className="relative before:absolute before:left-[15px] before:top-0 before:bottom-0 before:w-px before:bg-border">
        {events.map((event, index) => (
          <div
            key={event.eventLogId}
            className={`relative ${index === events.length - 1 ? "pb-0" : "pb-8"}`}
          >
            <StepCard
              event={event}
              index={index}
              isLast={index === events.length - 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
