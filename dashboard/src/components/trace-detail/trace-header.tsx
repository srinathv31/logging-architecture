import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { STATUS_ICONS } from "@/lib/constants";
import type { TraceDetail } from "@/data/queries";
import { Activity, Timer } from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const STATUS_ORDER = ["SUCCESS", "FAILURE", "IN_PROGRESS", "SKIPPED"] as const;

interface TraceHeaderProps {
  traceId: string;
  detail: TraceDetail;
}

export function TraceHeader({ traceId, detail }: TraceHeaderProps) {
  return (
    <Card className="shadow-sm hover:shadow-lg transition-shadow border-t-4 border-t-primary">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">Trace Detail</h1>
            <p className="font-mono text-sm text-muted-foreground break-all">
              {traceId}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              {detail.events.length} events
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1.5">
              <Timer className="h-4 w-4" />
              {formatDuration(detail.totalDurationMs)}
            </span>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Status summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {STATUS_ORDER.map((status) => {
            const count = detail.statusCounts[status] ?? 0;
            const Icon = STATUS_ICONS[status];
            return (
              <div
                key={status}
                className={`rounded-lg bg-muted/50 p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)] hover:shadow-md transition-shadow ${count === 0 ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {Icon && (
                    <Icon
                      className={`h-4 w-4 ${
                        status === "SUCCESS"
                          ? "text-green-600 dark:text-green-400"
                          : status === "FAILURE"
                            ? "text-red-600 dark:text-red-400"
                            : status === "IN_PROGRESS"
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-gray-500 dark:text-gray-400"
                      }`}
                    />
                  )}
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-2xl font-light tabular-nums">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Systems */}
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Systems
          </p>
          <div className="flex flex-wrap gap-1">
            {detail.systemsInvolved.map((system) => (
              <Badge key={system} variant="outline">
                {system}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
