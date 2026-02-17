import type { TraceEvent } from "@/data/queries";

export interface Attempt {
  attemptNumber: number;
  rootSpanId: string | null;
  events: TraceEvent[];
  status: "success" | "failure" | "in_progress";
}

export interface RetryInfo {
  attempts: Attempt[];
  finalAttempt: Attempt;
  overallStatus: "success" | "failure" | "in_progress";
}

/**
 * Detects retry attempts within a trace.
 * Multiple PROCESS_START events with the same processName indicate retries.
 * Returns null for non-retry traces (0 or 1 PROCESS_START).
 */
export function detectAttempts(events: TraceEvent[]): RetryInfo | null {
  if (events.length === 0) return null;

  // Find all PROCESS_START events — use the most common processName to avoid
  // matching sub-processes that happen to also have PROCESS_START
  const processStarts = events
    .filter((e) => e.eventType === "PROCESS_START")
    .sort(
      (a, b) =>
        new Date(a.eventTimestamp).getTime() -
        new Date(b.eventTimestamp).getTime()
    );

  if (processStarts.length <= 1) return null;

  // Count processName occurrences among PROCESS_START events to find the primary process
  const nameCounts = new Map<string, number>();
  for (const ps of processStarts) {
    nameCounts.set(ps.processName, (nameCounts.get(ps.processName) ?? 0) + 1);
  }
  let primaryProcessName = processStarts[0].processName;
  let maxCount = 0;
  for (const [name, count] of nameCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryProcessName = name;
    }
  }

  // Filter to only PROCESS_START events matching the primary process
  const retryStarts = processStarts.filter(
    (e) => e.processName === primaryProcessName
  );

  if (retryStarts.length <= 1) return null;

  // Build attempts: assign events to attempts based on parentSpanId matching
  const attempts: Attempt[] = retryStarts.map((ps, index) => ({
    attemptNumber: index + 1,
    rootSpanId: ps.spanId,
    events: [ps], // start with the PROCESS_START event itself
    status: "in_progress" as const,
  }));

  // Create a lookup from rootSpanId -> attempt index
  const spanToAttempt = new Map<string, number>();
  for (let i = 0; i < attempts.length; i++) {
    const spanId = attempts[i].rootSpanId;
    if (spanId) {
      spanToAttempt.set(spanId, i);
    }
  }

  // Assign remaining events
  const assignedIds = new Set(retryStarts.map((e) => e.eventLogId));
  const unassigned: TraceEvent[] = [];

  for (const event of events) {
    if (assignedIds.has(event.eventLogId)) continue;

    // Try parentSpanId match
    if (event.parentSpanId && spanToAttempt.has(event.parentSpanId)) {
      attempts[spanToAttempt.get(event.parentSpanId)!].events.push(event);
    } else {
      unassigned.push(event);
    }
  }

  // Fallback: assign orphan events to closest preceding attempt by timestamp
  for (const event of unassigned) {
    const eventTime = new Date(event.eventTimestamp).getTime();
    let bestAttemptIndex = 0;
    for (let i = retryStarts.length - 1; i >= 0; i--) {
      if (new Date(retryStarts[i].eventTimestamp).getTime() <= eventTime) {
        bestAttemptIndex = i;
        break;
      }
    }
    attempts[bestAttemptIndex].events.push(event);
  }

  // Sort events within each attempt by timestamp
  for (const attempt of attempts) {
    attempt.events.sort(
      (a, b) =>
        new Date(a.eventTimestamp).getTime() -
        new Date(b.eventTimestamp).getTime()
    );
  }

  // Determine per-attempt status
  for (const attempt of attempts) {
    const hasProcessEnd = attempt.events.some(
      (e) =>
        e.eventType === "PROCESS_END" &&
        e.eventStatus === "SUCCESS" &&
        e.processName === primaryProcessName
    );
    const hasFailure = attempt.events.some(
      (e) => e.eventStatus === "FAILURE"
    );

    if (hasProcessEnd) {
      attempt.status = "success";
    } else if (hasFailure) {
      attempt.status = "failure";
    }
    // else remains "in_progress"
  }

  const finalAttempt = attempts[attempts.length - 1];

  return {
    attempts,
    finalAttempt,
    overallStatus: finalAttempt.status,
  };
}

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

  // Identify which groups are actually parallel (more than 1 event with different spanIds)
  const parallelGroupKeys = new Set<string>();
  for (const [key, group] of groups) {
    if (group.length > 1) {
      const uniqueSpanIds = new Set(group.map((e) => e.spanId).filter(Boolean));
      if (uniqueSpanIds.size > 1) {
        parallelGroupKeys.add(key);
      }
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

export interface StepFlowNode {
  type: "sequential" | "parallel";
  steps: {
    stepName: string | null;
    stepSequence: number | null;
    eventType: string;
    eventStatus: string;
    processName: string;
    targetSystem: string;
    executionTimeMs: number | null;
  }[];
}

export function buildStepFlow(events: TraceEvent[]): StepFlowNode[] {
  const timeline = buildSpanTree(events);
  return timeline.map((entry) => {
    return {
      type: entry.type,
      steps: entry.events.map((e) => ({
        stepName: e.stepName,
        stepSequence: e.stepSequence,
        eventType: e.eventType,
        eventStatus: e.eventStatus,
        processName: e.processName,
        targetSystem: e.targetSystem,
        executionTimeMs: e.executionTimeMs,
      })),
    };
  });
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
