---
title: EventLogTemplate
---

# EventLogTemplate

`EventLogTemplate` provides a fluent API to reduce boilerplate and reuse defaults across process steps.

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

## Important Notes

- `ProcessLogger` is **mutable** and request-scoped. Don't share across threads.
- Identifiers added via `addIdentifier()` stack forward to all subsequent events in the process.
- The template automatically resolves `applicationId`, `targetSystem`, and `originatingSystem` from configuration.
