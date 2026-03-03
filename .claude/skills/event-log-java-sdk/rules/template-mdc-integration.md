---
title: MDC Integration for Correlation and Trace IDs
impact: HIGH
impactDescription: missing MDC setup means events lack correlation/trace IDs
tags: template, mdc, correlation, trace, filter
---

## MDC Integration for Correlation and Trace IDs

Set correlationId and traceId in MDC at request entry (servlet filter/interceptor). EventLogTemplate reads from MDC automatically — no manual wiring needed.

**Incorrect (manually passing correlationId to every forProcess() call, forgetting to set MDC):**

```java
@Service
public class OrderService {
    private final EventLogTemplate template;

    public void processOrder(Order order, String correlationId, String traceId) {
        // BAD: manually threading IDs through every method call
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .withCorrelationId(correlationId)
            .withTraceId(traceId);
        // ...
    }
}
```

**Correct (set MDC once at request entry, EventLogTemplate reads automatically):**

```java
// In your filter/interceptor — set once at request entry
MDC.put("correlationId", EventLogUtils.createCorrelationId("orders"));
MDC.put("traceId", EventLogUtils.createTraceId());
```

```yaml
# Spring Boot auto-config: enable MDC filter
# application.yml:
eventlog:
  mdc-filter:
    url-patterns: "/api/*"
```

```java
// No manual correlation ID wiring needed — MDC values are picked up automatically
@Service
public class OrderService {
    private final EventLogTemplate template;

    public void processOrder(Order order) {
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .addIdentifier("orderId", order.getId());
        // correlationId and traceId are read from MDC automatically
        process.processStart("Processing order", "INITIATED");
    }
}
```

Supported MDC keys: `correlationId`, `traceId`, `spanId`, `parentSpanId`, `batchId` (also supports snake_case and kebab-case variants such as `correlation_id`, `correlation-id`, etc.).

- The MDC filter registers a servlet filter that populates MDC for matching URL patterns.
- Multiple URL patterns: `url-patterns: "/api/*,/webhook/*"`
