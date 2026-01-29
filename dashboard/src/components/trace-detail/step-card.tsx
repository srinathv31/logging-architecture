import { Badge } from "@/components/ui/badge";
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_ICONS,
  STATUS_ICONS,
  HTTP_METHOD_COLORS,
} from "@/lib/constants";
import type { TraceEvent } from "@/data/queries";
import { AlertCircle, Server, Timer } from "lucide-react";
import { EventLogSteps } from "./event-log-steps";

const STATUS_ICON_COLORS: Record<string, string> = {
  SUCCESS: "text-green-500",
  FAILURE: "text-red-500",
  IN_PROGRESS: "text-yellow-500",
  SKIPPED: "text-gray-400",
};

const STATUS_BG_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-500",
  FAILURE: "bg-red-500",
  IN_PROGRESS: "bg-yellow-500",
  SKIPPED: "bg-gray-400",
};

const STATUS_RING_COLORS: Record<string, string> = {
  SUCCESS: "ring-green-500/20",
  FAILURE: "ring-red-500/20",
  IN_PROGRESS: "ring-yellow-500/20",
  SKIPPED: "ring-gray-400/20",
};

interface StepCardProps {
  event: TraceEvent;
  index: number;
  isLast: boolean;
  timeDiff?: string;
  compact?: boolean;
  hideTimelineIndicator?: boolean;
}

export function StepCard({ event, index, timeDiff, compact, hideTimelineIndicator }: StepCardProps) {
  const StatusIcon = STATUS_ICONS[event.eventStatus];
  const EventIcon = EVENT_TYPE_ICONS[event.eventType];
  const isInProgress = event.eventStatus === "IN_PROGRESS";
  const iconColor = STATUS_ICON_COLORS[event.eventStatus] ?? "text-gray-400";
  const bgColor = STATUS_BG_COLORS[event.eventStatus] ?? "bg-gray-400";
  const ringColor = STATUS_RING_COLORS[event.eventStatus] ?? "ring-gray-400/20";

  return (
    <div className={`relative group ${compact ? "" : ""}`}>
      {/* Status indicator — absolute positioned */}
      {!hideTimelineIndicator && (
        <div
          className={`
            absolute left-0 top-4 z-10 w-8 h-8 rounded-full bg-background
            border-2 border-background shadow-sm
            flex items-center justify-center
            ring-4 ${ringColor}
            transition-transform group-hover:scale-110
            ${isInProgress ? "animate-pulse" : ""}
          `}
        >
          <div className={`absolute inset-1 rounded-full ${bgColor} opacity-10`} />
          {StatusIcon && <StatusIcon className={`h-4 w-4 ${iconColor} relative z-10`} />}
        </div>
      )}

      {/* Time diff badge */}
      {timeDiff && !hideTimelineIndicator && (
        <div className="absolute left-10 top-0 -translate-y-1">
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {timeDiff}
          </span>
        </div>
      )}

      {/* Card content — offset right */}
      <div className={hideTimelineIndicator ? "" : "ml-12"}>
        <div 
          className={`
            relative overflow-hidden rounded-xl border bg-card shadow-sm
            transition-all duration-200
            hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50
          `}
        >
          {/* Left status border */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${bgColor}`} />
          
          <div className={compact ? "p-3 pl-4" : "p-4 pl-5"}>
            {/* Top row - Step number and badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono text-xs bg-muted/50">
                Step {event.stepSequence ?? index + 1}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs gap-1 ${EVENT_TYPE_COLORS[event.eventType] ?? ""}`}
              >
                {EventIcon && <EventIcon className="h-3 w-3" />}
                {event.eventType}
              </Badge>
              {event.httpMethod && (
                <Badge
                  variant="secondary"
                  className={`font-mono font-bold text-xs ${HTTP_METHOD_COLORS[event.httpMethod] ?? ""}`}
                >
                  {event.httpMethod}
                </Badge>
              )}
              {event.httpStatusCode !== null && (
                <Badge
                  variant={event.httpStatusCode >= 400 ? "destructive" : "outline"}
                  className="font-mono text-xs"
                >
                  {event.httpStatusCode}
                </Badge>
              )}
              
              {/* Status badge for compact mode */}
              {hideTimelineIndicator && StatusIcon && (
                <Badge variant="outline" className={`text-xs gap-1 ${iconColor}`}>
                  <StatusIcon className="h-3 w-3" />
                  {event.eventStatus.replace("_", " ")}
                </Badge>
              )}
              {/* Target system badge */}
              <Badge variant="outline" className="text-xs gap-1 ml-auto">
                <Server className="h-3 w-3 opacity-50" />
                {event.targetSystem}
              </Badge>
            </div>

            {/* Step name */}
            <h3 className="font-semibold text-base mb-1.5 break-words group-hover:text-primary transition-colors">
              {event.stepName ?? event.processName}
            </h3>

            {/* Summary */}
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {event.summary}
            </p>

            {/* Bottom metadata row */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 min-w-0">
                {event.endpoint && (
                  <span className="font-mono truncate max-w-[200px] bg-muted/50 px-1.5 py-0.5 rounded">
                    {event.endpoint}
                  </span>
                )}
                {event.executionTimeMs !== null && (
                  <span className="font-mono shrink-0 flex items-center gap-1">
                    <Timer className="h-3 w-3 opacity-50" />
                    {event.executionTimeMs}ms
                  </span>
                )}
              </div>
              <EventLogSteps event={event} />
            </div>

            {/* Error callout */}
            {event.errorMessage && (
              <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-3 py-2 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  {event.errorCode && (
                    <p className="font-mono font-semibold text-xs text-red-800 dark:text-red-200 mb-0.5">
                      {event.errorCode}
                    </p>
                  )}
                  <p className="text-xs text-red-700 dark:text-red-300 line-clamp-2">
                    {event.errorMessage}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
