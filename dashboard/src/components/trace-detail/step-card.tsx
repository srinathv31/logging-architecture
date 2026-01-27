import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_ICONS,
  STATUS_ICONS,
  HTTP_METHOD_COLORS,
} from "@/lib/constants";
import type { TraceEvent } from "@/data/queries";
import { AlertCircle } from "lucide-react";
import { EventLogSteps } from "./event-log-steps";

const STATUS_ICON_COLORS: Record<string, string> = {
  SUCCESS: "text-green-500",
  FAILURE: "text-red-500",
  IN_PROGRESS: "text-yellow-500",
  SKIPPED: "text-gray-400",
};

interface StepCardProps {
  event: TraceEvent;
  index: number;
  isLast: boolean;
}

export function StepCard({ event, index }: StepCardProps) {
  const StatusIcon = STATUS_ICONS[event.eventStatus];
  const EventIcon = EVENT_TYPE_ICONS[event.eventType];
  const isInProgress = event.eventStatus === "IN_PROGRESS";
  const iconColor = STATUS_ICON_COLORS[event.eventStatus] ?? "text-gray-400";

  return (
    <div className="relative">
      {/* Status indicator — absolute positioned */}
      <div
        className={`absolute left-0 top-3 z-10 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center ${isInProgress ? "animate-pulse" : ""}`}
      >
        {StatusIcon && <StatusIcon className={`h-4 w-4 ${iconColor}`} />}
      </div>

      {/* Card content — offset right */}
      <div className="ml-12">
        <Card className="py-0 gap-0 hover:shadow-md transition-shadow duration-200 hover:border-primary">
          <CardContent className="p-4">
            {/* Badge row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono text-xs">
                Step {event.stepSequence ?? index + 1}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs ${EVENT_TYPE_COLORS[event.eventType] ?? ""}`}
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
            </div>

            {/* Step name */}
            <h3 className="font-semibold text-base mb-1 break-words">
              {event.stepName ?? event.processName}
            </h3>

            {/* Summary */}
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {event.summary}
            </p>

            {/* Bottom metadata row */}
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 min-w-0">
                {event.endpoint && (
                  <span className="font-mono truncate">{event.endpoint}</span>
                )}
                {event.endpoint && event.executionTimeMs !== null && (
                  <span>&bull;</span>
                )}
                {event.executionTimeMs !== null && (
                  <span className="font-mono shrink-0">
                    {event.executionTimeMs}ms
                  </span>
                )}
              </div>
              <EventLogSteps event={event} />
            </div>

            {/* Error callout */}
            {event.errorMessage && (
              <div className="mt-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-300 line-clamp-2">
                  {event.errorCode && (
                    <span className="font-mono font-medium">
                      [{event.errorCode}]{" "}
                    </span>
                  )}
                  {event.errorMessage}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
