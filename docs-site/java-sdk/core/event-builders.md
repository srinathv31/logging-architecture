---
title: Event Builders
---

# Event Builders (EventLogUtils)

::: tip Prefer EventLogTemplate for most use cases
[EventLogTemplate](/java-sdk/core/event-log-template) and its `ProcessLogger` API handle shared defaults, MDC integration, span hierarchy, and one-shot fields automatically. Use the raw builders below only when you need full control over every field or are integrating with a custom pipeline.
:::

The SDK provides helper methods for creating properly structured events with correct `eventType` values.

## Helper Methods

```java
import static com.eventlog.sdk.util.EventLogUtils.*;
```

### processStart

Creates a `PROCESS_START` event:

```java
EventLogEntry start = processStart(correlationId, traceId, "EMPLOYEE_CARD_ORIGINATION")
    .applicationId("employee-origination-service")
    .targetSystem("EMPLOYEE_ORIGINATION_SERVICE")
    .originatingSystem("HR_PORTAL")
    .summary("Employee card origination initiated for employee EMP-456")
    .result("INITIATED")
    .addIdentifier("employee_id", "EMP-456")
    .build();
```

### step

Creates a `STEP` event:

```java
EventLogEntry step = step(correlationId, traceId, "EMPLOYEE_CARD_ORIGINATION", 1, "HR Validation")
    .applicationId("employee-origination-service")
    .targetSystem("WORKDAY")
    .originatingSystem("EMPLOYEE_ORIGINATION_SERVICE")
    .eventStatus(EventStatus.SUCCESS)
    .summary("Validated employee EMP-456 exists in Workday")
    .result("EMPLOYEE_VERIFIED")
    .executionTimeMs(245)
    .build();
```

### processEnd

Creates a `PROCESS_END` event:

```java
EventLogEntry end = processEnd(correlationId, traceId, "EMPLOYEE_CARD_ORIGINATION", 5, EventStatus.SUCCESS, 3200)
    .applicationId("employee-origination-service")
    .targetSystem("HR_PORTAL")
    .originatingSystem("EMPLOYEE_ORIGINATION_SERVICE")
    .summary("Employee card origination completed for EMP-456")
    .result("COMPLETED_APPROVED")
    .build();
```

## ID Generation Helpers

```java
// Correlation ID with team prefix
String correlationId = createCorrelationId("auth");
// e.g., "auth-a1b2c3d4-e5f6g7h8"

// W3C Trace Context trace ID (32 lowercase hex chars)
String traceId = createTraceId();

// Span ID (16 lowercase hex chars)
String spanId = createSpanId();

// Batch ID with prefix
String batchId = createBatchId("hr-upload");
```

## Sending Events

```java
// Single event
client.createEvent(start);

// Multiple events in batch
client.createEvents(List.of(start, step, end));
```
