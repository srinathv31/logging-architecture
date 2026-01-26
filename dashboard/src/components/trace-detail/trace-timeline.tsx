import type { TraceEvent } from "@/data/queries";
import { StepCard } from "./step-card";

interface TraceTimelineProps {
  events: TraceEvent[];
}

export function TraceTimeline({ events }: TraceTimelineProps) {
  return (
    <div className="relative">
      {events.map((event, index) => (
        <StepCard
          key={event.eventLogId}
          event={event}
          index={index}
          isLast={index === events.length - 1}
        />
      ))}
    </div>
  );
}
