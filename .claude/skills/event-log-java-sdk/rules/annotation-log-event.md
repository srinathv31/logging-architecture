---
title: "@LogEvent Annotation Pattern"
impact: HIGH
impactDescription: reduces boilerplate for simple method-level logging
tags: annotation, log-event, aop, automatic
---

## @LogEvent Annotation Pattern

Annotate methods with @LogEvent to automatically log execution as STEP events. AOP intercepts, records timing, logs success/failure based on outcome.

**Incorrect (using @LogEvent for multi-step processes — use EventLogTemplate instead):**

```java
@Service
public class OrderService {

    // BAD: Multi-step process should use EventLogTemplate + ProcessLogger
    @LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Full Order Flow")
    public void processOrder(Order order) {
        validateOrder(order);
        reserveInventory(order);
        chargeCard(order);
        sendConfirmation(order);
        // All steps collapsed into one event — no step-level visibility
    }
}
```

**Correct (use @LogEvent for simple, single-purpose methods):**

```java
@Service
public class OrderService {

    @LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Validate Order")
    public void validateOrder(Order order) {
        // method execution logged as a STEP event automatically
    }

    @LogEvent(process = "ORDER_PROCESSING", step = 2, name = "Charge Card",
            successStatus = EventStatus.SUCCESS, failureStatus = EventStatus.FAILURE)
    public void chargeCard(Order order) {
        // on success: STEP with SUCCESS status
        // on exception: STEP with FAILURE status
    }
}
```

Requirements:
- Spring Boot starter dependency (AOP enabled automatically)
- `eventlog.application-id` or `spring.application.name` must be set
- Uses MDC values for correlation/trace IDs when present
- `targetSystem` and `originatingSystem` default to `applicationId`

### When to use @LogEvent vs EventLogTemplate

| | EventLogTemplate | @LogEvent |
|---|---|---|
| Best for | Multi-step processes | Simple method-level logging |
| Control | Full — payloads, timing, identifiers per step | Convention-based |
| How | Inject template, call logStep() | Annotate methods |
