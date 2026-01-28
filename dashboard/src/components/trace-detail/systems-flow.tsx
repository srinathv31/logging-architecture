import { CheckCircle2, XCircle, Clock, MinusCircle, ArrowRight, Server } from "lucide-react";
import type { TraceEvent } from "@/data/queries";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SystemsFlowProps {
  events: TraceEvent[];
}

interface SystemNode {
  name: string;
  eventCount: number;
  successCount: number;
  failureCount: number;
  inProgressCount: number;
  order: number;
}

const STATUS_ICONS = {
  success: CheckCircle2,
  failure: XCircle,
  inProgress: Clock,
  mixed: MinusCircle,
};

const STATUS_COLORS = {
  success: "text-green-500 bg-green-500/10 border-green-500/30",
  failure: "text-red-500 bg-red-500/10 border-red-500/30",
  inProgress: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  mixed: "text-gray-500 bg-gray-500/10 border-gray-500/30",
};

function getSystemStatus(node: SystemNode): "success" | "failure" | "inProgress" | "mixed" {
  if (node.failureCount > 0) return "failure";
  if (node.inProgressCount > 0) return "inProgress";
  if (node.successCount === node.eventCount) return "success";
  return "mixed";
}

export function SystemsFlow({ events }: SystemsFlowProps) {
  // Build system flow from events
  const systemMap = new Map<string, SystemNode>();
  let orderCounter = 0;

  events.forEach((event) => {
    // Track target system
    if (!systemMap.has(event.targetSystem)) {
      systemMap.set(event.targetSystem, {
        name: event.targetSystem,
        eventCount: 0,
        successCount: 0,
        failureCount: 0,
        inProgressCount: 0,
        order: orderCounter++,
      });
    }

    const node = systemMap.get(event.targetSystem)!;
    node.eventCount++;
    if (event.eventStatus === "SUCCESS") node.successCount++;
    else if (event.eventStatus === "FAILURE") node.failureCount++;
    else if (event.eventStatus === "IN_PROGRESS") node.inProgressCount++;
  });

  // Sort by order of appearance
  const systems = Array.from(systemMap.values()).sort((a, b) => a.order - b.order);

  if (systems.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        System Journey
      </h3>
      
      <div className="flex items-center justify-start gap-2 overflow-x-auto pb-2">
        <TooltipProvider>
          {systems.map((system, index) => {
            const status = getSystemStatus(system);
            const StatusIcon = STATUS_ICONS[status];
            const colorClasses = STATUS_COLORS[status];

            return (
              <div key={system.name} className="flex items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        flex flex-col items-center gap-2 p-4 rounded-lg border-2 min-w-[100px]
                        transition-all hover:scale-105 hover:shadow-md cursor-default
                        ${colorClasses}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 opacity-60" />
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium text-center whitespace-nowrap">
                        {system.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {system.eventCount} event{system.eventCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold">{system.name}</p>
                      <p>Total: {system.eventCount} events</p>
                      {system.successCount > 0 && (
                        <p className="text-green-500">Success: {system.successCount}</p>
                      )}
                      {system.failureCount > 0 && (
                        <p className="text-red-500">Failures: {system.failureCount}</p>
                      )}
                      {system.inProgressCount > 0 && (
                        <p className="text-yellow-500">In Progress: {system.inProgressCount}</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Arrow connector */}
                {index < systems.length - 1 && (
                  <div className="flex items-center px-2">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-border to-primary/50" />
                    <ArrowRight className="h-4 w-4 text-primary/50 -ml-1" />
                  </div>
                )}
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
