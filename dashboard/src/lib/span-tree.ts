import type { TraceEvent } from "@/data/queries";

export interface EnrichedEvent {
  event: TraceEvent;
  isParallelGroup: boolean;
  parallelSiblings: TraceEvent[];
  isJoinPoint: boolean;
}

export interface TimelineEntry {
  type: "sequential" | "parallel";
  events: TraceEvent[];
}

/**
 * Detects parallel execution groups from trace events.
 * Events sharing the same parentSpanId AND stepSequence are parallel siblings.
 * Returns a structured timeline with sequential and parallel entries.
 */
export function buildSpanTree(events: TraceEvent[]): TimelineEntry[] {
  if (events.length === 0) return [];

  // Group events by parentSpanId + stepSequence to find parallel siblings
  const groups = new Map<string, TraceEvent[]>();
  const ungrouped: TraceEvent[] = [];

  for (const event of events) {
    if (event.parentSpanId && event.stepSequence !== null) {
      const key = `${event.parentSpanId}:${event.stepSequence}`;
      const group = groups.get(key);
      if (group) {
        group.push(event);
      } else {
        groups.set(key, [event]);
      }
    } else {
      ungrouped.push(event);
    }
  }

  // Identify which groups are actually parallel (more than 1 event)
  const parallelGroupKeys = new Set<string>();
  for (const [key, group] of groups) {
    if (group.length > 1) {
      parallelGroupKeys.add(key);
    }
  }

  // Build the timeline entries preserving original order
  const timeline: TimelineEntry[] = [];
  const processedIds = new Set<number>();

  for (const event of events) {
    if (processedIds.has(event.eventLogId)) continue;

    const key =
      event.parentSpanId && event.stepSequence !== null
        ? `${event.parentSpanId}:${event.stepSequence}`
        : null;

    if (key && parallelGroupKeys.has(key)) {
      // This is part of a parallel group — emit the entire group
      const group = groups.get(key)!;
      for (const e of group) processedIds.add(e.eventLogId);
      timeline.push({ type: "parallel", events: group });
    } else {
      // Sequential event
      processedIds.add(event.eventLogId);
      timeline.push({ type: "sequential", events: [event] });
    }
  }

  return timeline;
}

/**
 * Detects whether a trace contains any parallel execution.
 */
export function hasParallelExecution(events: TraceEvent[]): boolean {
  return buildSpanTree(events).some((entry) => entry.type === "parallel");
}

/**
 * Gets the ordered list of unique target systems from events,
 * detecting fork/join points for flow visualization.
 */
export interface FlowNode {
  systems: string[];
  isParallel: boolean;
}

export function buildSystemFlow(events: TraceEvent[]): FlowNode[] {
  const timeline = buildSpanTree(events);
  const flow: FlowNode[] = [];
  const seen = new Set<string>();

  for (const entry of timeline) {
    if (entry.type === "parallel") {
      const systems = [
        ...new Set(entry.events.map((e) => e.targetSystem)),
      ].filter((s) => !seen.has(s));
      if (systems.length > 0) {
        for (const s of systems) seen.add(s);
        flow.push({ systems, isParallel: true });
      }
    } else {
      const system = entry.events[0].targetSystem;
      if (!seen.has(system)) {
        seen.add(system);
        flow.push({ systems: [system], isParallel: false });
      }
    }
  }

  return flow;
}
