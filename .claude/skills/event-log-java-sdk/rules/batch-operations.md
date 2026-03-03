---
title: Batch Operations with batchId
impact: MEDIUM
impactDescription: enables monitoring of bulk operations as a cohesive unit
tags: advanced, batch, bulk, batchId
---

## Batch Operations with batchId

When processing bulk operations (file uploads, batch imports, scheduled jobs), group related events under a shared `batchId`. Each individual event retains its own `correlationId` and `traceId` for independent tracking.

**Incorrect (reusing same correlationId for all batch items):**

```java
// WRONG — all items share one correlationId, making individual tracking impossible
String corrId = createCorrelationId("emp");
for (CsvRow row : csvRows) {
    processStart(corrId, createTraceId(), "EMPLOYEE_CARD_ORIGINATION")
        .summary("Employee card origination for " + row.getEmployeeId())
        .build();
}
```

**Correct (shared batchId, unique correlationId per item):**

```java
String batchId = createBatchId("hr-upload");

List<EventLogEntry> events = csvRows.stream()
    .map(row -> {
        String corrId = createCorrelationId("emp");
        return processStart(corrId, createTraceId(), "EMPLOYEE_CARD_ORIGINATION")
            .batchId(batchId)
            .applicationId("employee-origination-service")
            .summary("Employee card origination for " + row.getEmployeeId())
            .addIdentifier("employee_id", row.getEmployeeId())
            .build();
    })
    .collect(Collectors.toList());

var response = client.createEvents(events);
```

**Check batch progress:**

```java
var summary = client.getBatchSummary(batchId);
// summary.getCompleted(), summary.getFailed(), summary.getInProgress()
```

The `batchId` ties all events together for aggregate monitoring while each event's unique `correlationId` and `traceId` allow drilling into individual item processing.
