---
title: Batch Operations
---

# Batch Operations

For batch uploads (e.g., CSV processing, bulk imports), use the batch API to group events together.

## Creating a Batch

```typescript
import { createBatchId, createCorrelationId, createTraceId } from '@yourcompany/eventlog-sdk';

const batchId = createBatchId('hr-upload');

// Process each CSV row
const events = csvRows.map((row) => {
  const correlationId = createCorrelationId('emp');

  return createProcessStartEvent({
    correlation_id: correlationId,
    trace_id: createTraceId(),
    batch_id: batchId,  // Groups all rows together
    application_id: 'employee-origination-service',
    target_system: 'EMPLOYEE_ORIGINATION_SERVICE',
    originating_system: 'HR_PORTAL',
    process_name: 'EMPLOYEE_CARD_ORIGINATION',
    summary: `Employee card origination initiated for ${row.employeeId}`,
    result: 'INITIATED',
    identifiers: {
      employee_id: row.employeeId,
    },
  });
});

// Send batch
await client.createEvents(events);
```

## Checking Batch Progress

```typescript
const summary = await client.getBatchSummary(batchId);
console.log(`Completed: ${summary.completed}/${summary.total_processes}`);
```

## Notes

- Each event in a batch gets its own `correlation_id` and `trace_id`
- The `batch_id` ties them together for monitoring
- Use `client.createEvents()` for synchronous batch sends
- For fire-and-forget, loop through events and call `eventLog.log()` individually
