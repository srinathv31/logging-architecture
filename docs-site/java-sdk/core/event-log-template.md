---
title: EventLogTemplate
---

# EventLogTemplate

The primary API for logging events. `EventLogTemplate` provides a fluent API to reduce boilerplate and reuse defaults across process steps.

## Auto-Configuration

When the Spring Boot starter is enabled, an `EventLogTemplate` bean is auto-configured if `eventlog.application-id`, `eventlog.target-system`, `eventlog.originating-system`, or `spring.application.name` is set.

In non-Spring apps, build it manually:

```java
EventLogTemplate template = EventLogTemplate.builder(eventLog).build();
```

## ProcessLogger

`ProcessLogger` is the primary API for logging multi-step processes:

```java
@Service
public class OrderService {
    private final EventLogTemplate template;

    public OrderService(EventLogTemplate template) {
        this.template = template;
    }

    public void processOrder(Order order) {
        // IDs read from MDC automatically
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .addIdentifier("orderId", order.getId());

        process.logStep(1, "Validate Order", EventStatus.SUCCESS, "Order validated");

        // Add data as you learn it - stacks forward to subsequent events
        String reservationId = reserveInventory(order);
        process.addIdentifier("reservationId", reservationId);

        process.logStep(2, "Reserve Inventory", EventStatus.SUCCESS, "Reserved");
    }
}
```

## MDC Integration

Set correlation IDs once at request entry (filter/interceptor), then let `EventLogTemplate` read them automatically:

```java
// In your filter/interceptor - use your team's prefix
MDC.put("correlationId", EventLogUtils.createCorrelationId("orders"));
MDC.put("traceId", EventLogUtils.createTraceId());
```

Supported MDC keys: `correlationId`, `traceId`, `spanId`, `parentSpanId`, `batchId` (also supports snake_case and kebab-case variants).

## ProcessLogger API Reference

### Persistent Fields

These are set once and apply to **all** subsequent events in the process:

| Method | Description |
|--------|-------------|
| `withCorrelationId(String)` | Set the correlation ID |
| `withTraceId(String)` | Set the trace ID |
| `withSpanId(String)` | Set the root span ID |
| `withParentSpanId(String)` | Set the caller parent span ID |
| `withBatchId(String)` | Set the batch ID |
| `withApplicationId(String)` | Override template's applicationId |
| `withDefaultTargetSystem(String)` | Override template's targetSystem for all events |
| `withOriginatingSystem(String)` | Override template's originatingSystem |
| `withAccountId(String)` | Set accountId on all events |
| `withAwaitCompletion()` | Use `IN_PROGRESS` status on processStart |
| `addIdentifier(String, String)` | Add key-value identifier (stacks forward) |
| `addMetadata(String, Object)` | Add key-value metadata (stacks forward) |

### One-Shot Fields

These are applied to the **next** emit call only, then automatically cleared:

| Method | Description |
|--------|-------------|
| `withTargetSystem(String)` | Override targetSystem for next event only |
| `withEndpoint(String)` | Set endpoint for next event only |
| `withHttpMethod(HttpMethod)` | Set HTTP method for next event only |
| `withHttpStatusCode(Integer)` | Set HTTP status code for next event only |
| `withSpanLinks(List<String>)` | Set span links for next event only |
| `addSpanLink(String)` | Add a span link for next event only |
| `withRequestPayload(String)` | Set request payload for next event only |
| `withResponsePayload(String)` | Set response payload for next event only |
| `withExecutionTimeMs(Integer)` | Set execution time for next event only |
| `withIdempotencyKey(String)` | Set idempotency key for next event only |
| `withErrorCode(String)` | Set error code for next event only |
| `withErrorMessage(String)` | Set error message for next event only |

### Emit Methods

| Method | Description |
|--------|-------------|
| `processStart(String summary, String result)` | Emit a `PROCESS_START` event (stepSequence=0) |
| `logStep(int seq, String name, EventStatus, String summary, String result)` | Emit a `STEP` event |
| `logStep(int seq, String name, EventStatus, String summary)` | Emit a `STEP` (result defaults to status name) |
| `processEnd(int seq, EventStatus, String summary, String result, Integer totalDurationMs)` | Emit a `PROCESS_END` event |
| `processEnd(int seq, EventStatus, String summary)` | Emit a `PROCESS_END` (result defaults to status name) |
| `error(String code, String message, String summary, String result)` | Emit an `ERROR` event |
| `error(String code, String message, String summary)` | Emit an `ERROR` (result defaults to "FAILED") |
| `error(String code, String message)` | Emit an `ERROR` (summary = message, result = "FAILED") |

::: tip Override behavior
`processEnd()`'s `totalDurationMs` parameter overrides any pending `withExecutionTimeMs()` value. Similarly, `error()`'s `errorCode`/`errorMessage` parameters override pending `withErrorCode()`/`withErrorMessage()` values.
:::

## Examples

### HTTP Logging with Request/Response Payloads

```java
ProcessLogger process = template.forProcess("PARTNER_API_CALL")
    .withCorrelationId(correlationId)
    .withTraceId(traceId);

process.processStart("Calling partner verification API", "INITIATED");

var response = httpClient.send(request);

process.withEndpoint("/api/v2/partners/verify")
    .withHttpMethod(HttpMethod.POST)
    .withHttpStatusCode(response.statusCode())
    .withRequestPayload(requestBody)
    .withResponsePayload(response.body())
    .withExecutionTimeMs((int) response.duration().toMillis())
    .logStep(1, "Partner Verify", EventStatus.SUCCESS,
        "Partner verified successfully", "VERIFIED");

// endpoint, httpMethod, httpStatusCode are auto-cleared along with payloads
process.processEnd(2, EventStatus.SUCCESS, "API call complete", "DONE", totalMs);
```

### Warning Steps with Error Context

Use `withErrorCode()` and `withErrorMessage()` on non-error events to capture partial failure context:

```java
process.withErrorCode("RATE_LIMIT")
    .withErrorMessage("429 Too Many Requests — retrying in 2s")
    .logStep(2, "Call External API", EventStatus.WARNING,
        "Rate limited by partner, will retry", "RETRYING");

// Next step — error fields auto-clear
process.logStep(3, "Retry API Call", EventStatus.SUCCESS,
    "Retry succeeded", "OK");
```

### Per-Step Timing

Track execution time on individual steps without affecting other events:

```java
long start = System.currentTimeMillis();
var result = queryDatabase();
int elapsed = (int) (System.currentTimeMillis() - start);

process.withExecutionTimeMs(elapsed)
    .logStep(1, "DB Query", EventStatus.SUCCESS,
        "Fetched 42 records", "OK");

// Next step — executionTimeMs is automatically cleared
process.logStep(2, "Transform Data", EventStatus.SUCCESS,
    "Transformed records", "OK");
```

## Important Notes

- `ProcessLogger` is **mutable** and request-scoped. Don't share across threads.
- Identifiers added via `addIdentifier()` stack forward to all subsequent events in the process.
- The template automatically resolves `applicationId`, `targetSystem`, and `originatingSystem` from configuration.
