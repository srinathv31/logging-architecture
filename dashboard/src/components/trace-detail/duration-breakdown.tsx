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

interface SystemDuration {
  system: string;
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
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function DurationBreakdown({ events }: DurationBreakdownProps) {
  // Group events by targetSystem, sum executionTimeMs
  const systemMap = new Map<string, number>();

  for (const event of events) {
    if (event.executionTimeMs !== null && event.executionTimeMs > 0) {
      const current = systemMap.get(event.targetSystem) ?? 0;
      systemMap.set(event.targetSystem, current + event.executionTimeMs);
    }
  }

  if (systemMap.size === 0) return null;

  const totalMs = Array.from(systemMap.values()).reduce((a, b) => a + b, 0);

  // Build ordered entries
  const entries: SystemDuration[] = Array.from(systemMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([system, ms], index) => ({
      system,
      totalMs: ms,
      percentage: totalMs > 0 ? (ms / totalMs) * 100 : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

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
          {entries.map((entry) => (
            <Tooltip key={entry.system}>
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
                      {entry.system}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold">{entry.system}</p>
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
        {entries.map((entry) => (
          <div key={entry.system} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">
              {entry.system}
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
