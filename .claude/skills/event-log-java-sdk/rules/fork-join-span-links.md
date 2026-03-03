---
title: Fork-Join and Span Links for Parallel Steps
impact: MEDIUM
impactDescription: enables visualization of parallel step dependencies in trace timelines
tags: advanced, fork-join, parallel, span-links
---

## Fork-Join and Span Links for Parallel Steps

When a process has steps that execute in parallel, use the same `step_sequence` for concurrent steps and `spanLinks` on the join step to reference them. This enables the dashboard to visualize fork-join patterns correctly.

**Incorrect (sequential step numbers for parallel steps):**

```java
// WRONG — implies serial execution when these run in parallel
EventLogEntry odsStep = step(corrId, traceId, processName, 2, "Create ODS Entry")
    .spanId("span-003").parentSpanId("span-002").build();

EventLogEntry regulatoryStep = step(corrId, traceId, processName, 3, "Initialize Regulatory")
    .spanId("span-004").parentSpanId("span-002").build();

EventLogEntry joinStep = step(corrId, traceId, processName, 4, "Background Checks")
    .spanId("span-005").parentSpanId("span-002").build();
```

**Correct (shared step_sequence for parallel steps, spanLinks on join):**

```java
// Parallel steps (both step_sequence = 2)
EventLogEntry odsStep = step(corrId, traceId, processName, 2, "Create ODS Entry")
    .spanId("span-003").parentSpanId("span-002").build();

EventLogEntry regulatoryStep = step(corrId, traceId, processName, 2, "Initialize Regulatory")
    .spanId("span-004").parentSpanId("span-002").build();

// Join step references both parallel steps
EventLogEntry joinStep = step(corrId, traceId, processName, 3, "Background Checks")
    .spanId("span-005").parentSpanId("span-002")
    .spanLinks(List.of("span-003", "span-004"))  // References parallel steps
    .build();
```

Visualization:

```
Step 1 ──┬── Step 2a (ODS)          ──┬── Step 3 (Join)
         └── Step 2b (Regulatory)  ───┘
```

Each parallel step gets its own unique `spanId` but shares the same `step_sequence` number. The downstream join step uses `spanLinks` to declare that it depends on both parallel steps completing.
