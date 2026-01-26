"use client";

import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS } from "@/lib/constants";
import type { TraceSummary } from "@/data/queries";
import { formatDistanceToNow } from "date-fns";

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const columns: ColumnDef<TraceSummary>[] = [
  {
    accessorKey: "traceId",
    header: "Trace ID",
    cell: ({ row }) => (
      <Link
        href={`/trace/${encodeURIComponent(row.original.traceId)}`}
        className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
      >
        {row.original.traceId.length > 24
          ? `${row.original.traceId.slice(0, 24)}...`
          : row.original.traceId}
      </Link>
    ),
  },
  {
    accessorKey: "processName",
    header: "Process Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.processName}</span>
    ),
  },
  {
    accessorKey: "accountId",
    header: "Account ID",
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {row.original.accountId ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "eventCount",
    header: "Events",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.eventCount}</span>
    ),
  },
  {
    accessorKey: "latestStatus",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.latestStatus;
      return (
        <Badge variant="secondary" className={STATUS_COLORS[status] ?? ""}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "totalDurationMs",
    header: "Duration",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {formatDuration(row.original.totalDurationMs)}
      </span>
    ),
  },
  {
    accessorKey: "lastEventAt",
    header: "Last Event",
    cell: ({ row }) => {
      const dateStr = row.original.lastEventAt;
      if (!dateStr) return "-";
      try {
        return (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(dateStr), { addSuffix: true })}
          </span>
        );
      } catch {
        return <span className="text-sm text-muted-foreground">{dateStr}</span>;
      }
    },
  },
];
