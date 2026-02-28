---
title: Batch Operations
---

# Batch Operations

For batch uploads (e.g., CSV processing, bulk imports), use the batch API to group events together.

## Creating a Batch

```java
String batchId = createBatchId("hr-upload");

List<EventLogEntry> events = csvRows.stream()
    .map(row -> {
        String corrId = createCorrelationId("emp");
        return processStart(corrId, createTraceId(), "EMPLOYEE_CARD_ORIGINATION")
            .batchId(batchId)  // Group all rows under same batch
            .applicationId("employee-origination-service")
            .targetSystem("EMPLOYEE_ORIGINATION_SERVICE")
            .originatingSystem("HR_PORTAL")
            .summary("Employee card origination initiated for " + row.getEmployeeId())
            .result("INITIATED")
            .addIdentifier("employee_id", row.getEmployeeId())
            .build();
    })
    .collect(Collectors.toList());

var response = client.createEvents(events);
```

## Checking Batch Progress

```java
var summary = client.getBatchSummary(batchId);
System.out.printf("Batch %s: %d completed, %d failed, %d in progress%n",
    batchId, summary.getCompleted(), summary.getFailed(), summary.getInProgress());
```

## Notes

- Each event in a batch gets its own `correlationId` and `traceId`
- The `batchId` ties them together for monitoring
- Use `client.createEvents()` for synchronous batch sends
- For fire-and-forget, loop through events and call `eventLog.log()` individually
