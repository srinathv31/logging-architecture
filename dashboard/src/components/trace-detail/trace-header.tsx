"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { STATUS_ICONS } from "@/lib/constants";
import type { TraceDetail } from "@/data/queries";
import { Activity, Timer, Copy, Check, Server, Calendar } from "lucide-react";
import { useState } from "react";

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const STATUS_ORDER = ["SUCCESS", "FAILURE", "IN_PROGRESS", "SKIPPED"] as const;

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "from-green-500/20 to-green-500/5 border-green-500/30",
  FAILURE: "from-red-500/20 to-red-500/5 border-red-500/30",
  IN_PROGRESS: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
  SKIPPED: "from-gray-500/20 to-gray-500/5 border-gray-500/30",
};

const STATUS_ICON_COLORS: Record<string, string> = {
  SUCCESS: "text-green-600 dark:text-green-400",
  FAILURE: "text-red-600 dark:text-red-400",
  IN_PROGRESS: "text-yellow-600 dark:text-yellow-400",
  SKIPPED: "text-gray-500 dark:text-gray-400",
};

function formatProcessName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatTimeRange(startTime: string, endTime: string): { start: string; end: string } {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const dateOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };

  const startStr = startDate.toLocaleString("en-US", dateOpts);
  // If same day, only show time for end
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const endStr = sameDay
    ? endDate.toLocaleString("en-US", timeOpts)
    : endDate.toLocaleString("en-US", dateOpts);

  return { start: startStr, end: endStr };
}

interface TraceHeaderProps {
  traceId: string;
  detail: TraceDetail;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-7 px-2 text-muted-foreground hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

export function TraceHeader({ traceId, detail }: TraceHeaderProps) {
  // Determine overall status for header styling
  const hasFailures = (detail.statusCounts["FAILURE"] ?? 0) > 0;
  const hasInProgress = (detail.statusCounts["IN_PROGRESS"] ?? 0) > 0;
  const overallStatus = hasFailures ? "FAILURE" : hasInProgress ? "IN_PROGRESS" : "SUCCESS";

  return (
    <div className="space-y-4">
      {/* Main Header Card */}
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Gradient overlay based on status */}
        <div className={`absolute inset-0 bg-gradient-to-br ${STATUS_COLORS[overallStatus]} pointer-events-none`} />
        
        <div className="relative p-6">
          {/* Top row - Title and metrics */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {formatProcessName(detail.processName)}
                  </h1>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">
                    Trace Journey
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <code className="font-mono text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    {traceId}
                  </code>
                  <CopyButton text={traceId} />
                </div>
                {detail.accountId && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Account:</span>
                    <code className="font-mono text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      {detail.accountId}
                    </code>
                    <CopyButton text={detail.accountId} />
                  </div>
                )}
              </div>
            </div>
            
            {/* Key metrics */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{detail.events.length}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Events
                </p>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{formatDuration(detail.totalDurationMs)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Duration
                </p>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{detail.systemsInvolved.length}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  Systems
                </p>
              </div>
            </div>
          </div>

          {/* Status summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {STATUS_ORDER.map((status) => {
              const count = detail.statusCounts[status] ?? 0;
              const Icon = STATUS_ICONS[status];
              const isActive = count > 0;
              
              return (
                <div
                  key={status}
                  className={`
                    relative overflow-hidden rounded-lg border p-3 transition-all
                    ${isActive 
                      ? "bg-card shadow-sm hover:shadow-md" 
                      : "bg-muted/30 opacity-60"
                    }
                  `}
                >
                  {isActive && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${STATUS_COLORS[status].split(" ")[0].replace("from-", "from-").replace("/20", "")}`} />
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {Icon && (
                        <Icon className={`h-4 w-4 ${STATUS_ICON_COLORS[status]}`} />
                      )}
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xl font-semibold tabular-nums">{count}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time range */}
          {detail.startTime && detail.endTime && (() => {
            const { start, end } = formatTimeRange(detail.startTime, detail.endTime);
            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Calendar className="h-3.5 w-3.5" />
                <span>Started: <span className="font-medium text-foreground">{start}</span></span>
                <span className="opacity-40">—</span>
                <span>Completed: <span className="font-medium text-foreground">{end}</span></span>
              </div>
            );
          })()}

          {/* Systems badges */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
              Systems Involved
            </p>
            <div className="flex flex-wrap gap-2">
              {detail.systemsInvolved.map((system) => (
                <Badge 
                  key={system} 
                  variant="secondary"
                  className="px-3 py-1 bg-primary/5 hover:bg-primary/10 border-primary/20"
                >
                  <Server className="h-3 w-3 mr-1.5 opacity-60" />
                  {system}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
