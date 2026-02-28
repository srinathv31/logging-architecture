---
title: Fork-Join
---

# Fork-Join Pattern (Parallel Steps)

When steps run in parallel and a subsequent step depends on them, use span links to express the causal relationship.

## How It Works

1. Give parallel steps the **same `step_sequence`** number
2. Each parallel step gets its own `spanId`
3. The dependent step uses `spanLinks` to reference the parallel steps it waited for

## Example

```java
// Parallel steps (both have step_sequence = 2)
EventLogEntry odsStep = step(corrId, traceId, processName, 2, "Create ODS Entry")
    .spanId("span-003")
    .parentSpanId("span-002")
    // ... other fields
    .build();

EventLogEntry regulatoryStep = step(corrId, traceId, processName, 2, "Initialize Regulatory Controls")
    .spanId("span-004")
    .parentSpanId("span-002")
    // ... other fields
    .build();

// Step that waits for both parallel steps
EventLogEntry dependentStep = step(corrId, traceId, processName, 3, "Background Checks")
    .spanId("span-005")
    .parentSpanId("span-002")
    .spanLinks(List.of("span-003", "span-004"))  // Waited for both
    // ... other fields
    .build();
```

## Visualization

In the dashboard, span links appear as dashed connections in the trace timeline, making it clear which steps were forked and where they joined.

```
Step 1 ──┬── Step 2a (ODS)          ──┬── Step 3 (Background Checks)
         └── Step 2b (Regulatory)  ───┘
```
