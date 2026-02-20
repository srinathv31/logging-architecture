"use client";

import type { TraceEvent } from "@/data/queries";
import { Timer } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DurationBreakdownProps {
  events: TraceEvent[];
}

interface StepDuration {
  label: string;
  targetSystem: string;
  totalMs: number;
  percentage: number;
  color: string;
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatMs(ms: number): string {
  if (ms <= 0) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Duration Breakdown — shows a stacked bar of per-step durations.
 *
 * Duration source priority:
 *   1. The event's explicit `executionTimeMs` (if > 0)
 *   2. Timestamp gap to the next event (computed from sorted events)
 *
 * PROCESS_START and PROCESS_END are excluded from the bar — they are markers,
 * not business steps.  Consecutive events sharing the same step identity
 * (parentSpanId + stepSequence + stepName) are merged so that
 * IN_PROGRESS → SUCCESS transitions show as a single bar.
 */
export function DurationBreakdown({ events }: DurationBreakdownProps) {
  if (events.length === 0) return null;

  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.eventTimestamp).getTime() -
      new Date(b.eventTimestamp).getTime()
  );

  // Group STEP events into step groups, merging status transitions
  const stepGroups: {
    key: string;
    events: TraceEvent[];
    firstTs: number;
  }[] = [];

  for (const event of sorted) {
    if (event.eventType === "PROCESS_START" || event.eventType === "PROCESS_END")
      continue;

    const key = `${event.parentSpanId ?? ""}:${event.stepSequence}:${event.stepName ?? event.processName}`;
    const last = stepGroups[stepGroups.length - 1];

    if (last && last.key === key) {
      last.events.push(event);
    } else {
      stepGroups.push({
        key,
        events: [event],
        firstTs: new Date(event.eventTimestamp).getTime(),
      });
    }
  }

  // Compute duration for each step group
  const entries: StepDuration[] = [];
  let colorIndex = 0;

  for (let i = 0; i < stepGroups.length; i++) {
    const group = stepGroups[i];
    const representative = group.events[group.events.length - 1];

    // Priority: explicit executionTimeMs > timestamp-derived duration
    const explicitMs = group.events.find(
      (e) => e.executionTimeMs != null && e.executionTimeMs > 0
    )?.executionTimeMs;

    let durationMs: number;
    if (explicitMs) {
      durationMs = explicitMs;
    } else if (i < stepGroups.length - 1) {
      durationMs = stepGroups[i + 1].firstTs - group.firstTs;
    } else {
      // Last step: gap to the final event in the trace (often PROCESS_END)
      const lastTs = new Date(
        sorted[sorted.length - 1].eventTimestamp
      ).getTime();
      durationMs = lastTs - group.firstTs;
    }

    if (durationMs < 0) continue;

    entries.push({
      label: representative.stepName ?? representative.eventType,
      targetSystem: representative.targetSystem,
      totalMs: durationMs,
      percentage: 0,
      color: CHART_COLORS[colorIndex % CHART_COLORS.length],
    });
    colorIndex++;
  }

  if (entries.length === 0) return null;

  const totalMs = entries.reduce((sum, e) => sum + e.totalMs, 0);
  for (const entry of entries) {
    entry.percentage = totalMs > 0 ? (entry.totalMs / totalMs) * 100 : 0;
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm card-glow">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Timer className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Duration Breakdown
        </h3>
        <span className="ml-auto text-xs font-mono text-muted-foreground">
          Total: {formatMs(totalMs)}
        </span>
      </div>

      {/* Stacked bar */}
      <TooltipProvider>
        <div className="flex h-8 w-full rounded-lg overflow-hidden border">
          {entries.map((entry, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className="h-full transition-opacity hover:opacity-80 cursor-default relative"
                  style={{
                    width: `${Math.max(entry.percentage, 2)}%`,
                    backgroundColor: entry.color,
                  }}
                >
                  {entry.percentage > 12 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white truncate px-1">
                      {entry.label}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold">{entry.label}</p>
                  <p>System: {entry.targetSystem}</p>
                  <p>
                    {formatMs(entry.totalMs)} ({entry.percentage.toFixed(1)}%)
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">
              {entry.label}
            </span>
            <span className="text-xs font-mono font-medium">
              {formatMs(entry.totalMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
