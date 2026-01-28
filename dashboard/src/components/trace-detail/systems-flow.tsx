"use client";

import { CheckCircle2, XCircle, Clock, MinusCircle, Server, Network } from "lucide-react";
import type { TraceEvent } from "@/data/queries";
import { buildSystemFlow } from "@/lib/span-tree";
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
  totalTimeMs: number;
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

function formatMs(ms: number): string {
  if (ms <= 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function SystemNodeCard({ node }: { node: SystemNode }) {
  const status = getSystemStatus(node);
  const StatusIcon = STATUS_ICONS[status];
  const colorClasses = STATUS_COLORS[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 min-w-[120px]
            transition-all hover:scale-105 hover:shadow-md cursor-default
            ${colorClasses}
          `}
        >
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 opacity-60" />
            <StatusIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-center whitespace-nowrap">
            {node.name}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>
              {node.eventCount} event{node.eventCount !== 1 ? "s" : ""}
            </span>
            {node.totalTimeMs > 0 && (
              <>
                <span className="opacity-40">|</span>
                <span className="font-mono">{formatMs(node.totalTimeMs)}</span>
              </>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-semibold">{node.name}</p>
          <p>Total: {node.eventCount} events</p>
          {node.totalTimeMs > 0 && (
            <p className="font-mono">Time: {formatMs(node.totalTimeMs)}</p>
          )}
          {node.successCount > 0 && (
            <p className="text-green-500">Success: {node.successCount}</p>
          )}
          {node.failureCount > 0 && (
            <p className="text-red-500">Failures: {node.failureCount}</p>
          )}
          {node.inProgressCount > 0 && (
            <p className="text-yellow-500">In Progress: {node.inProgressCount}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function Arrow() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20" className="shrink-0">
      <line
        x1="0"
        y1="10"
        x2="30"
        y2="10"
        className="stroke-primary/40 flow-line-animated"
        strokeWidth="2"
      />
      <polygon
        points="28,5 38,10 28,15"
        className="fill-primary/40"
      />
    </svg>
  );
}

function ForkArrows({ count }: { count: number }) {
  const height = Math.max(count * 50, 60);
  const mid = height / 2;
  const spacing = count > 1 ? (height - 20) / (count - 1) : 0;

  return (
    <svg width="50" height={height} viewBox={`0 0 50 ${height}`} className="shrink-0">
      {Array.from({ length: count }).map((_, i) => {
        const y = count > 1 ? 10 + i * spacing : mid;
        return (
          <g key={i}>
            <path
              d={`M 0 ${mid} Q 25 ${mid} 25 ${y} L 40 ${y}`}
              fill="none"
              className="stroke-primary/40 flow-line-animated"
              strokeWidth="2"
            />
            <polygon
              points={`38,${y - 4} 48,${y} 38,${y + 4}`}
              className="fill-primary/40"
            />
          </g>
        );
      })}
    </svg>
  );
}

function JoinArrows({ count }: { count: number }) {
  const height = Math.max(count * 50, 60);
  const mid = height / 2;
  const spacing = count > 1 ? (height - 20) / (count - 1) : 0;

  return (
    <svg width="50" height={height} viewBox={`0 0 50 ${height}`} className="shrink-0">
      {Array.from({ length: count }).map((_, i) => {
        const y = count > 1 ? 10 + i * spacing : mid;
        return (
          <path
            key={i}
            d={`M 0 ${y} L 25 ${y} Q 25 ${y} 50 ${mid}`}
            fill="none"
            className="stroke-primary/40 flow-line-animated"
            strokeWidth="2"
          />
        );
      })}
      <polygon
        points={`42,${mid - 4} 50,${mid} 42,${mid + 4}`}
        className="fill-primary/40"
      />
    </svg>
  );
}

export function SystemsFlow({ events }: SystemsFlowProps) {
  // Build per-system stats
  const systemMap = new Map<string, SystemNode>();

  for (const event of events) {
    if (!systemMap.has(event.targetSystem)) {
      systemMap.set(event.targetSystem, {
        name: event.targetSystem,
        eventCount: 0,
        successCount: 0,
        failureCount: 0,
        inProgressCount: 0,
        totalTimeMs: 0,
      });
    }

    const node = systemMap.get(event.targetSystem)!;
    node.eventCount++;
    if (event.eventStatus === "SUCCESS") node.successCount++;
    else if (event.eventStatus === "FAILURE") node.failureCount++;
    else if (event.eventStatus === "IN_PROGRESS") node.inProgressCount++;
    if (event.executionTimeMs) node.totalTimeMs += event.executionTimeMs;
  }

  const flow = buildSystemFlow(events);

  if (flow.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm card-glow">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Network className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          System Journey
        </h3>
      </div>

      <div className="flex items-center justify-start gap-0 overflow-x-auto pb-2">
        <TooltipProvider>
          {flow.map((node, index) => {
            const isParallel = node.isParallel && node.systems.length > 1;

            return (
              <div key={node.systems.join("-")} className="flex items-center">
                {/* Arrow before this node */}
                {index > 0 && !isParallel && <Arrow />}
                {index > 0 && isParallel && (
                  <ForkArrows count={node.systems.length} />
                )}

                {isParallel ? (
                  <div className="flex flex-col gap-2">
                    {node.systems.map((sys) => {
                      const sysNode = systemMap.get(sys);
                      if (!sysNode) return null;
                      return <SystemNodeCard key={sys} node={sysNode} />;
                    })}
                  </div>
                ) : (
                  (() => {
                    const sysNode = systemMap.get(node.systems[0]);
                    if (!sysNode) return null;
                    return <SystemNodeCard node={sysNode} />;
                  })()
                )}

                {/* Join arrow after parallel group */}
                {isParallel && index < flow.length - 1 && (
                  <JoinArrows count={node.systems.length} />
                )}
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
