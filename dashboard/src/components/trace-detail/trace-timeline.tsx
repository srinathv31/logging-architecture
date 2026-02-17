import type { TraceEvent } from "@/data/queries";
import { Badge } from "@/components/ui/badge";
import { StepCard } from "./step-card";
import { SystemsFlow } from "./systems-flow";
import { ParallelGroup } from "./parallel-group";
import { buildSpanTree, type Attempt, type RetryInfo } from "@/lib/span-tree";
import { Clock, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TraceTimelineProps {
  events: TraceEvent[];
  retryInfo?: RetryInfo | null;
}

function formatTimeDiff(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`;
  return `+${(ms / 60000).toFixed(1)}m`;
}

const ATTEMPT_STATUS_CONFIG = {
  success: {
    label: "Succeeded",
    icon: CheckCircle2,
    headerBg: "bg-green-500/10 border-green-500/30",
    headerText: "text-green-700 dark:text-green-300",
    iconColor: "text-green-500",
  },
  failure: {
    label: "Failed",
    icon: XCircle,
    headerBg: "bg-red-500/10 border-red-500/30",
    headerText: "text-red-700 dark:text-red-300",
    iconColor: "text-red-500",
  },
  in_progress: {
    label: "In Progress",
    icon: Loader2,
    headerBg: "bg-yellow-500/10 border-yellow-500/30",
    headerText: "text-yellow-700 dark:text-yellow-300",
    iconColor: "text-yellow-500",
  },
};

function AttemptGroup({
  attempt,
  isFinal,
}: {
  attempt: Attempt;
  isFinal: boolean;
}) {
  const config = ATTEMPT_STATUS_CONFIG[attempt.status];
  const StatusIcon = config.icon;
  const timeline = buildSpanTree(attempt.events);
  const eventTimestamps = attempt.events.map(
    (e) => new Date(e.eventTimestamp).getTime()
  );
  const firstTimestamp =
    eventTimestamps.length > 0 ? Math.min(...eventTimestamps) : 0;
  const isNonFinalFailure = !isFinal && attempt.status === "failure";

  return (
    <div className={`rounded-xl border bg-card shadow-sm overflow-hidden ${isNonFinalFailure ? "opacity-60" : ""}`}>
      {/* Attempt header bar */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${config.headerBg}`}>
        <StatusIcon className={`h-4 w-4 ${config.iconColor}`} />
        <span className={`text-sm font-semibold ${config.headerText}`}>
          Attempt {attempt.attemptNumber}
        </span>
        <span className={`text-xs ${config.headerText} opacity-75`}>
          — {config.label}
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {attempt.events.length} events
        </Badge>
      </div>

      {/* Attempt timeline */}
      <div className="p-4">
        <div className="relative">
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-border" />

          {timeline.map((entry, entryIndex) => {
            if (entry.type === "parallel") {
              return (
                <div
                  key={`parallel-${entryIndex}`}
                  className="relative pb-6"
                >
                  <ParallelGroup
                    events={entry.events}
                    firstTimestamp={firstTimestamp}
                  />
                </div>
              );
            }

            const event = entry.events[0];
            const eventTime = new Date(event.eventTimestamp).getTime();
            const timeDiff = eventTime - firstTimestamp;
            const isLast = entryIndex === timeline.length - 1;

            return (
              <div
                key={event.eventLogId}
                className={`relative ${isLast ? "pb-0" : "pb-6"}`}
              >
                <StepCard
                  event={event}
                  index={event.stepSequence ?? entryIndex}
                  isLast={isLast}
                  timeDiff={timeDiff > 0 ? formatTimeDiff(timeDiff) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TraceTimeline({ events, retryInfo }: TraceTimelineProps) {
  const eventTimestamps = events.map(
    (e) => new Date(e.eventTimestamp).getTime()
  );
  const firstTimestamp =
    eventTimestamps.length > 0 ? Math.min(...eventTimestamps) : 0;

  // Retry-aware rendering: group by attempt
  if (retryInfo) {
    return (
      <div className="space-y-6">
        {/* Systems Flow Diagram — show all attempts for full retry visibility */}
        <SystemsFlow events={events} retryInfo={retryInfo} />

        {/* Timeline Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                Event Timeline
              </h2>
              <Badge variant="secondary" className="text-xs font-medium">
                {events.length} events
              </Badge>
              <Badge className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                <RefreshCw className="h-2.5 w-2.5 mr-1" />
                {retryInfo.attempts.length} Attempts
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            {retryInfo.attempts.map((attempt, index) => (
              <AttemptGroup
                key={attempt.attemptNumber}
                attempt={attempt}
                isFinal={index === retryInfo.attempts.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Non-retry: original flat timeline
  const timeline = buildSpanTree(events);

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
            <h2 className="text-xl font-semibold tracking-tight">
              Event Timeline
            </h2>
            <Badge variant="secondary" className="text-xs font-medium">
              {events.length} events
            </Badge>
          </div>
        </div>

        {/* Timeline with gradient line */}
        <div className="relative">
          {/* Gradient timeline line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-border" />

          {timeline.map((entry, entryIndex) => {
            if (entry.type === "parallel") {
              return (
                <div
                  key={`parallel-${entryIndex}`}
                  className="relative pb-6"
                >
                  <ParallelGroup
                    events={entry.events}
                    firstTimestamp={firstTimestamp}
                  />
                </div>
              );
            }

            const event = entry.events[0];
            const eventTime = new Date(event.eventTimestamp).getTime();
            const timeDiff = eventTime - firstTimestamp;
            const isLast = entryIndex === timeline.length - 1;

            return (
              <div
                key={event.eventLogId}
                className={`relative ${isLast ? "pb-0" : "pb-6"}`}
              >
                <StepCard
                  event={event}
                  index={event.stepSequence ?? entryIndex}
                  isLast={isLast}
                  timeDiff={timeDiff > 0 ? formatTimeDiff(timeDiff) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
