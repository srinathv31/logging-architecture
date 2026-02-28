"use client";

import { CheckCircle2, XCircle, Clock, AlertTriangle, Network, RefreshCw } from "lucide-react";
import type { TraceEvent } from "@/data/queries";
import {
  buildStepFlow,
  type StepFlowNode,
  type RetryInfo,
} from "@/lib/span-tree";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SystemsFlowProps {
  events: TraceEvent[];
  retryInfo?: RetryInfo | null;
}

type StepStatus = "success" | "failure" | "inProgress" | "warning";

const STATUS_ICONS = {
  success: CheckCircle2,
  failure: XCircle,
  inProgress: Clock,
  warning: AlertTriangle,
};

const STATUS_COLORS = {
  success: "text-green-500 bg-green-500/10 border-green-500/30",
  failure: "text-red-500 bg-red-500/10 border-red-500/30",
  inProgress: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/30",
};

function getStepStatus(status: string): StepStatus {
  if (status === "FAILURE") return "failure";
  if (status === "IN_PROGRESS") return "inProgress";
  if (status === "WARNING") return "warning";
  return "success";
}

function getStepLabel(step: StepFlowNode["steps"][number]): string {
  if (step.stepName) return step.stepName;
  return step.processName;
}

function formatMs(ms: number): string {
  if (ms <= 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function StepNodeCard({ step }: { step: StepFlowNode["steps"][number] }) {
  const status = getStepStatus(step.eventStatus);
  const StatusIcon = STATUS_ICONS[status];
  const colorClasses = STATUS_COLORS[status];
  const label = getStepLabel(step);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 min-w-[100px]
            transition-all hover:scale-105 hover:shadow-md cursor-default
            ${colorClasses}
          `}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold text-center whitespace-nowrap leading-tight">
            {label}
          </span>
          <span className="text-[9px] text-muted-foreground whitespace-nowrap">
            {step.targetSystem}
          </span>
          {step.executionTimeMs != null && step.executionTimeMs > 0 && (
            <span className="text-[9px] font-mono text-muted-foreground">
              {formatMs(step.executionTimeMs)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-semibold">{label}</p>
          <p>Type: {step.eventType}</p>
          <p>Status: {step.eventStatus}</p>
          <p>System: {step.targetSystem}</p>
          {step.executionTimeMs != null && step.executionTimeMs > 0 && (
            <p className="font-mono">Time: {formatMs(step.executionTimeMs)}</p>
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
      <polygon points="28,5 38,10 28,15" className="fill-primary/40" />
    </svg>
  );
}

function ForkArrows({ count }: { count: number }) {
  const height = Math.max(count * 50, 60);
  const mid = height / 2;
  const spacing = count > 1 ? (height - 20) / (count - 1) : 0;

  return (
    <svg
      width="50"
      height={height}
      viewBox={`0 0 50 ${height}`}
      className="shrink-0"
    >
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
    <svg
      width="50"
      height={height}
      viewBox={`0 0 50 ${height}`}
      className="shrink-0"
    >
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

export function SystemsFlow({ events, retryInfo }: SystemsFlowProps) {
  const flow = buildStepFlow(events);

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
        {retryInfo && (
          <span className="text-xs text-muted-foreground italic">
            (across all attempts)
          </span>
        )}
      </div>

      <div className="flex items-center justify-start gap-0 overflow-x-auto pt-4 pb-2">
        <TooltipProvider>
          {flow.map((node, index) => {
            const isParallel =
              node.type === "parallel" && node.steps.length > 1;
            const isRetry = node.type === "retry" && node.steps.length > 1;

            return (
              <div key={index} className="flex items-center">
                {/* Arrow before this node */}
                {index > 0 && !isParallel && <Arrow />}
                {index > 0 && isParallel && (
                  <ForkArrows count={node.steps.length} />
                )}

                {isParallel ? (
                  <div className="flex flex-col gap-2">
                    {node.steps.map((step, stepIdx) => (
                      <StepNodeCard key={stepIdx} step={step} />
                    ))}
                  </div>
                ) : isRetry ? (
                  <div className="relative mt-1">
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1
                                    bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5"
                    >
                      <RefreshCw className="h-2.5 w-2.5 text-amber-500" />
                      <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                        {node.steps.length} attempts
                      </span>
                    </div>
                    <div className="border border-dashed border-amber-500/40 rounded-lg p-1 pt-2">
                      <StepNodeCard step={node.steps[node.steps.length - 1]} />
                    </div>
                  </div>
                ) : (
                  <StepNodeCard step={node.steps[0]} />
                )}

                {/* Join arrow after parallel group */}
                {isParallel && index < flow.length - 1 && (
                  <JoinArrows count={node.steps.length} />
                )}
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
