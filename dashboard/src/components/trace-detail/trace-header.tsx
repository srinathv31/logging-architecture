import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { STATUS_COLORS } from "@/lib/constants";
import type { TraceDetail } from "@/data/queries";

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface TraceHeaderProps {
  traceId: string;
  detail: TraceDetail;
}

export function TraceHeader({ traceId, detail }: TraceHeaderProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">Trace Detail</h1>
            <p className="font-mono text-sm text-muted-foreground break-all">
              {traceId}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{detail.events.length} events</span>
            <Separator orientation="vertical" className="h-4" />
            <span>{formatDuration(detail.totalDurationMs)}</span>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex flex-wrap items-center gap-4">
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

          <Separator orientation="vertical" className="h-10 hidden sm:block" />

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Status Breakdown
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(detail.statusCounts).map(([status, count]) => (
                <Badge
                  key={status}
                  variant="secondary"
                  className={STATUS_COLORS[status] ?? ""}
                >
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
