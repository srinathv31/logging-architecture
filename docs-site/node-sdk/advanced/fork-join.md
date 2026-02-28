---
title: Fork-Join
---

# Fork-Join Pattern (Parallel Steps)

When steps run in parallel and a subsequent step depends on them, use span links to express the causal relationship.

## How It Works

1. Give parallel steps the **same `step_sequence`** number
2. Each parallel step gets its own `span_id`
3. The dependent step uses `span_links` to reference the parallel steps it waited for

## Example

```typescript
// Parallel steps (both have step_sequence = 2)
const odsStep = createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  span_id: 'span-003',
  parent_span_id: 'span-002',
  step_sequence: 2,
  step_name: 'Create ODS Entry',
  event_status: EventStatus.SUCCESS,
  // ... other fields
});

const regulatoryStep = createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  span_id: 'span-004',
  parent_span_id: 'span-002',
  step_sequence: 2,  // Same as above - parallel
  step_name: 'Initialize Regulatory Controls',
  event_status: EventStatus.SUCCESS,
  // ... other fields
});

// Step that waits for both
const dependentStep = createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  span_id: 'span-005',
  parent_span_id: 'span-002',
  span_links: ['span-003', 'span-004'],  // Waited for both parallel steps
  step_sequence: 3,
  step_name: 'Background Checks',
  event_status: EventStatus.SUCCESS,
  // ... other fields
});
```

## Visualization

```
Step 1 ──┬── Step 2a (ODS)          ──┬── Step 3 (Background Checks)
         └── Step 2b (Regulatory)  ───┘
```
