import type { TraceDetail } from "@/data/queries";
import { hasParallelExecution, buildStepFlow, type RetryInfo } from "@/lib/span-tree";
import { BookOpen } from "lucide-react";

interface JourneyNarrativeProps {
  traceId: string;
  detail: TraceDetail;
  retryInfo?: RetryInfo | null;
}

function formatProcessName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "unknown duration";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getKeyIdentifiers(detail: TraceDetail): string[] {
  const ids: string[] = [];
  const firstEvent = detail.events[0];
  if (!firstEvent) return ids;

  if (detail.accountId) {
    ids.push(`Account ${detail.accountId}`);
  }

  if (firstEvent.identifiers && typeof firstEvent.identifiers === "object") {
    const identObj = firstEvent.identifiers as Record<string, unknown>;
    for (const [key, value] of Object.entries(identObj)) {
      if (value && typeof value === "string" && ids.length < 3) {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .trim();
        ids.push(`${label}: ${value}`);
      }
    }
  }

  return ids;
}

export function JourneyNarrative({ detail, retryInfo }: JourneyNarrativeProps) {
  const processName = formatProcessName(detail.processName);
  const totalEvents = detail.events.length;
  const systemCount = detail.systemsInvolved.length;
  const hasFailures = (detail.statusCounts["FAILURE"] ?? 0) > 0;
  const failureCount = detail.statusCounts["FAILURE"] ?? 0;
  const hasWarnings = (detail.statusCounts["WARNING"] ?? 0) > 0;
  const warningCount = detail.statusCounts["WARNING"] ?? 0;
  const isParallel = hasParallelExecution(detail.events);
  const flow = buildStepFlow(detail.events);
  const retryNodes = flow.filter((n) => n.type === "retry");
  const stepRetriesResolved = retryNodes.length > 0 &&
    retryNodes.every((n) => n.steps[n.steps.length - 1].eventStatus === "SUCCESS");

  const hasProcessEnd = detail.events.some(
    (e) => e.eventType === "PROCESS_END"
  );
  const processEndSuccess = detail.events.some(
    (e) => e.eventType === "PROCESS_END" && e.eventStatus === "SUCCESS"
  );

  // Build ordered system list by first appearance
  const orderedSystems: string[] = [];
  const seen = new Set<string>();
  for (const event of detail.events) {
    if (!seen.has(event.targetSystem)) {
      seen.add(event.targetSystem);
      orderedSystems.push(event.targetSystem);
    }
  }

  // Determine outcome text
  let outcomeText: string;
  let outcomeClass: string;
  if (retryInfo) {
    // Retry-aware narrative
    if (retryInfo.overallStatus === "success") {
      outcomeText = "failed on the first attempt, then retried and completed successfully";
      outcomeClass = "text-green-600 dark:text-green-400";
    } else if (retryInfo.overallStatus === "failure") {
      outcomeText = `failed after ${retryInfo.attempts.length} attempts`;
      outcomeClass = "text-red-600 dark:text-red-400";
    } else {
      outcomeText = `retry attempt ${retryInfo.attempts.length} is in progress`;
      outcomeClass = "text-yellow-600 dark:text-yellow-400";
    }
  } else if (hasFailures) {
    outcomeText = `encountered ${failureCount} error${failureCount > 1 ? "s" : ""}`;
    outcomeClass = "text-red-600 dark:text-red-400";
  } else if (hasWarnings) {
    outcomeText = `completed with ${warningCount} warning${warningCount > 1 ? "s" : ""}`;
    outcomeClass = "text-amber-600 dark:text-amber-400";
  } else if (processEndSuccess) {
    outcomeText = "completed successfully";
    outcomeClass = "text-green-600 dark:text-green-400";
  } else if (hasProcessEnd) {
    outcomeText = "completed with issues";
    outcomeClass = "text-yellow-600 dark:text-yellow-400";
  } else {
    outcomeText = "is still in progress";
    outcomeClass = "text-yellow-600 dark:text-yellow-400";
  }

  // Build system traversal text
  const systemText =
    orderedSystems.length <= 3
      ? orderedSystems.join(", then ")
      : `${orderedSystems.slice(0, -1).join(", ")}, and ${orderedSystems[orderedSystems.length - 1]}`;

  // Key identifiers
  const identifiers = getKeyIdentifiers(detail);

  // Error summary
  const errorEvents = detail.events.filter((e) => e.errorMessage);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden card-glow">
      <div className="border-l-4 border-l-primary p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Journey Summary
          </h3>
        </div>

        <p className="text-sm leading-relaxed text-foreground/90">
          <span className="font-semibold">{processName}</span>{" "}
          <span className={`font-medium ${outcomeClass}`}>{outcomeText}</span>{" "}
          in{" "}
          <span className="font-mono font-medium">
            {formatDuration(detail.totalDurationMs)}
          </span>
          . The request traversed{" "}
          <span className="font-medium">{systemCount} systems</span>:{" "}
          <span className="text-muted-foreground">{systemText}</span>.{" "}
          {isParallel && (
            <span>
              Some steps executed{" "}
              <span className="font-medium text-primary">in parallel</span>.{" "}
            </span>
          )}
          {!retryInfo && retryNodes.length > 0 && (
            <span>
              {retryNodes.length} step{retryNodes.length > 1 ? "s" : ""} required{" "}
              <span className="font-medium text-amber-600 dark:text-amber-400">retries</span>
              {stepRetriesResolved ? " and resolved successfully" : ""}.{" "}
            </span>
          )}
          {retryInfo ? (
            <>
              Completed in{" "}
              <span className="font-medium">{retryInfo.attempts.length} attempts</span>{" "}
              with{" "}
              <span className="font-mono">{totalEvents}</span> total events.
            </>
          ) : (
            <>
              All{" "}
              <span className="font-mono">{totalEvents}</span> steps{" "}
              {hasFailures
                ? `completed with ${failureCount} failure${failureCount > 1 ? "s" : ""}`
                : "completed without errors"}
              .
            </>
          )}
        </p>

        {identifiers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {identifiers.map((id) => (
              <span
                key={id}
                className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground"
              >
                {id}
              </span>
            ))}
          </div>
        )}

        {errorEvents.length > 0 && (
          <div className={`mt-3 rounded-lg border px-3 py-2 ${
            retryInfo?.overallStatus === "success" || stepRetriesResolved
              ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50"
              : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50"
          }`}>
            <p className={`text-xs font-medium ${
              retryInfo?.overallStatus === "success" || stepRetriesResolved
                ? "text-amber-800 dark:text-amber-200"
                : "text-red-800 dark:text-red-200"
            }`}>
              {retryInfo?.overallStatus === "success" || stepRetriesResolved
                ? "Errors from earlier attempt(s): "
                : "Error summary: "}
              {errorEvents.map((e) => e.errorMessage).join("; ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
