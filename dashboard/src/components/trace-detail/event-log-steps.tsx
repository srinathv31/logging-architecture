"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PayloadViewer } from "./payload-viewer";
import {
  STATUS_COLORS,
  EVENT_TYPE_COLORS,
  STATUS_ICONS,
  EVENT_TYPE_ICONS,
  HTTP_METHOD_COLORS,
} from "@/lib/constants";
import type { TraceEvent } from "@/data/queries";
import { format, formatDistanceToNow } from "date-fns";
import {
  ExternalLink,
  Fingerprint,
  Server,
  Workflow,
  Clock,
  Globe,
  AlertCircle,
  Tag,
  FileJson,
  Code,
  Timer,
} from "lucide-react";

interface EventLogStepsProps {
  event: TraceEvent;
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        {label}
      </span>
      <span
        className={`text-xs text-right break-all ${mono ? "font-mono" : ""}`}
      >
        {String(value)}
      </span>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h3 className="text-sm font-semibold border-l-2 border-primary pl-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </h3>
  );
}

function SectionContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  );
}

export function EventLogSteps({ event }: EventLogStepsProps) {
  const StatusIcon = STATUS_ICONS[event.eventStatus];
  const EventIcon = EVENT_TYPE_ICONS[event.eventType];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
          <ExternalLink className="h-3 w-3" />
          View Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-left">
            {event.stepName ?? event.processName}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Step #{event.stepSequence ?? "—"} &middot; {event.processName}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge
              variant="secondary"
              className={`gap-1 ${EVENT_TYPE_COLORS[event.eventType] ?? ""}`}
            >
              {EventIcon && <EventIcon className="h-3 w-3" />}
              {event.eventType}
            </Badge>
            <Badge
              variant="secondary"
              className={`gap-1 ${STATUS_COLORS[event.eventStatus] ?? ""}`}
            >
              {StatusIcon && <StatusIcon className="h-3 w-3" />}
              {event.eventStatus}
            </Badge>
            {event.executionTimeMs !== null && (
              <Badge variant="outline" className="gap-1 font-mono">
                <Timer className="h-3 w-3" />
                {event.executionTimeMs}ms
              </Badge>
            )}
          </div>
          <Separator className="mt-3" />
        </DialogHeader>

        <div className="overflow-y-auto max-h-[75vh] px-6 pb-6">
          <div className="space-y-6">
            {/* 3-column summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)] text-center space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Target System
                </p>
                <p className="text-sm font-semibold">{event.targetSystem}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)] text-center space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Origin System
                </p>
                <p className="text-sm font-semibold">
                  {event.originatingSystem}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)] text-center space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Application
                </p>
                <p className="text-sm font-semibold">{event.applicationId}</p>
              </div>
            </div>

            {/* Two-column grid for core details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-4">
                {/* Identifiers */}
                <div className="space-y-2">
                  <SectionHeader icon={Fingerprint}>Identifiers</SectionHeader>
                  <SectionContainer>
                    <DetailRow label="Execution ID" value={event.executionId} mono />
                    <DetailRow label="Correlation ID" value={event.correlationId} mono />
                    <DetailRow label="Trace ID" value={event.traceId} mono />
                    <DetailRow label="Span ID" value={event.spanId} mono />
                    <DetailRow label="Parent Span ID" value={event.parentSpanId} mono />
                    <DetailRow label="Batch ID" value={event.batchId} mono />
                    <DetailRow label="Account ID" value={event.accountId} mono />
                  </SectionContainer>
                </div>

                {/* System Context */}
                <div className="space-y-2">
                  <SectionHeader icon={Server}>System Context</SectionHeader>
                  <SectionContainer>
                    <DetailRow label="Application ID" value={event.applicationId} />
                    <DetailRow label="Target System" value={event.targetSystem} />
                    <DetailRow
                      label="Originating System"
                      value={event.originatingSystem}
                    />
                  </SectionContainer>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Process Details */}
                <div className="space-y-2">
                  <SectionHeader icon={Workflow}>Process Details</SectionHeader>
                  <SectionContainer>
                    <DetailRow label="Process Name" value={event.processName} />
                    <DetailRow label="Step Sequence" value={event.stepSequence} />
                    <DetailRow label="Step Name" value={event.stepName} />
                    <DetailRow label="Event Type" value={event.eventType} />
                    <DetailRow label="Event Status" value={event.eventStatus} />
                    <DetailRow label="Summary" value={event.summary} />
                    <DetailRow label="Result" value={event.result} />
                  </SectionContainer>
                </div>

                {/* Timing */}
                <div className="space-y-2">
                  <SectionHeader icon={Clock}>Timing</SectionHeader>
                  <SectionContainer>
                    <DetailRow
                      label="Event Timestamp"
                      value={
                        event.eventTimestamp
                          ? `${format(new Date(event.eventTimestamp), "MMM d, yyyy HH:mm:ss.SSS")} (${formatDistanceToNow(new Date(event.eventTimestamp), { addSuffix: true })})`
                          : null
                      }
                    />
                    <DetailRow
                      label="Created At"
                      value={
                        event.createdAt
                          ? `${format(new Date(event.createdAt), "MMM d, yyyy HH:mm:ss.SSS")} (${formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })})`
                          : null
                      }
                    />
                    <DetailRow
                      label="Execution Time"
                      value={
                        event.executionTimeMs !== null
                          ? `${event.executionTimeMs}ms`
                          : null
                      }
                    />
                    {event.executionTimeMs !== null && event.executionTimeMs > 0 && (
                      <div className="px-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Execution</span>
                          <span className="font-mono">{event.executionTimeMs}ms</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(5, (event.executionTimeMs / 5000) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </SectionContainer>
                </div>
              </div>
            </div>

            {/* Full-width sections */}

            {/* HTTP Details */}
            {(event.endpoint || event.httpMethod || event.httpStatusCode) && (
              <div className="space-y-2">
                <SectionHeader icon={Globe}>HTTP Details</SectionHeader>
                <SectionContainer>
                  <div className="flex flex-wrap items-center gap-2 py-1.5 px-2">
                    {event.httpMethod && (
                      <Badge
                        variant="secondary"
                        className={`font-mono font-bold text-xs ${HTTP_METHOD_COLORS[event.httpMethod] ?? ""}`}
                      >
                        {event.httpMethod}
                      </Badge>
                    )}
                    {event.endpoint && (
                      <code className="text-xs font-mono text-muted-foreground flex-1 break-all">
                        {event.endpoint}
                      </code>
                    )}
                    {event.httpStatusCode && (
                      <Badge
                        variant={
                          event.httpStatusCode >= 400 ? "destructive" : "outline"
                        }
                        className="font-mono"
                      >
                        {event.httpStatusCode}
                      </Badge>
                    )}
                  </div>
                </SectionContainer>
              </div>
            )}

            {/* Error Details */}
            {(event.errorCode || event.errorMessage) && (
              <div className="space-y-2">
                <SectionHeader icon={AlertCircle}>Error Details</SectionHeader>
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 border-l-4 border-l-red-500">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div className="space-y-1 min-w-0">
                      {event.errorCode && (
                        <p className="text-sm font-mono font-semibold text-red-800 dark:text-red-200">
                          {event.errorCode}
                        </p>
                      )}
                      {event.errorMessage && (
                        <p className="text-sm text-red-700 dark:text-red-300 break-all">
                          {event.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Business Data */}
            <div className="space-y-2">
              <SectionHeader icon={Tag}>Business Identifiers</SectionHeader>
              <PayloadViewer
                content={
                  event.identifiers
                    ? JSON.stringify(event.identifiers)
                    : null
                }
                label="Identifiers"
              />
            </div>

            {event.metadata != null && (
              <div className="space-y-2">
                <SectionHeader icon={FileJson}>Metadata</SectionHeader>
                <PayloadViewer
                  content={JSON.stringify(event.metadata)}
                  label="Metadata"
                />
              </div>
            )}

            {/* Payloads */}
            <div className="space-y-2">
              <SectionHeader icon={Code}>Payloads</SectionHeader>
              <PayloadViewer
                content={event.requestPayload}
                label="Request Payload"
              />
              <PayloadViewer
                content={event.responsePayload}
                label="Response Payload"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
