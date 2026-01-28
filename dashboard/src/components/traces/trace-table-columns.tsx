"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_DOT_COLORS, STATUS_ICONS } from "@/lib/constants";
import type { TraceSummary } from "@/data/queries";
import { formatDistanceToNow } from "date-fns";
import { Activity, ArrowRight, Timer, Clock } from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function StatusDot({ status }: { status: string }) {
  const dotColor = STATUS_DOT_COLORS[status] ?? "bg-gray-400";
  const isInProgress = status === "IN_PROGRESS";
  
  return (
    <span 
      className={`
        inline-block h-2 w-2 rounded-full ${dotColor}
        ${isInProgress ? "animate-pulse" : ""}
      `} 
    />
  );
}

export const columns: ColumnDef<TraceSummary>[] = [
  {
    accessorKey: "traceId",
    header: "Trace",
    cell: ({ row }) => {
      const status = row.original.latestStatus;
      return (
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <Link
            href={`/trace/${encodeURIComponent(row.original.traceId)}`}
            className="group flex items-center gap-1.5 font-mono text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <span className="truncate max-w-[180px]">
              {row.original.traceId.length > 20
                ? `${row.original.traceId.slice(0, 20)}...`
                : row.original.traceId}
            </span>
            <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Link>
        </div>
      );
    },
  },
  {
    accessorKey: "processName",
    header: "Process",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{row.original.processName}</span>
      </div>
    ),
  },
  {
    accessorKey: "accountId",
    header: "Account",
    cell: ({ row }) => (
      <span className="font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">
        {row.original.accountId ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "eventCount",
    header: "Events",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="tabular-nums font-medium">{row.original.eventCount}</span>
      </div>
    ),
  },
  {
    accessorKey: "latestStatus",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.latestStatus;
      const Icon = STATUS_ICONS[status];
      return (
        <Badge variant="secondary" className={`gap-1 ${STATUS_COLORS[status] ?? ""}`}>
          {Icon && <Icon className="h-3 w-3" />}
          {status.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "totalDurationMs",
    header: "Duration",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Timer className="h-3.5 w-3.5" />
        <span className="tabular-nums text-sm font-mono">
          {formatDuration(row.original.totalDurationMs)}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "lastEventAt",
    header: "Last Activity",
    cell: ({ row }) => {
      const dateStr = row.original.lastEventAt;
      if (!dateStr) return <span className="text-muted-foreground">-</span>;
      try {
        return (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-sm">
              {formatDistanceToNow(new Date(dateStr), { addSuffix: true })}
            </span>
          </div>
        );
      } catch {
        return <span className="text-sm text-muted-foreground">{dateStr}</span>;
      }
    },
  },
];
