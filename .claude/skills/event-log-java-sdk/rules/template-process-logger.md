---
title: EventLogTemplate ProcessLogger Pattern
impact: CRITICAL
impactDescription: core API for logging multi-step processes — getting this wrong means missing or malformed events
tags: template, process-logger, forProcess, logStep, processStart, processEnd
---

## EventLogTemplate ProcessLogger Pattern

Inject EventLogTemplate, call forProcess("PROCESS_NAME"), add identifiers, then processStart followed by logStep per step followed by processEnd. Log immediately after each step (not batched at end).

**Incorrect (collecting events in a list and sending at end — crashes lose all events, creating raw EventLogEntry objects manually):**

```java
@Service
public class OrderService {
    private final EventLogTemplate template;

    public void processOrder(Order order) {
        List<EventLogEntry> events = new ArrayList<>();

        events.add(new EventLogEntry("ORDER_PROCESSING", "Start", ...));
        validateOrder(order);
        events.add(new EventLogEntry("ORDER_PROCESSING", "Validate", ...));
        reserveInventory(order);
        events.add(new EventLogEntry("ORDER_PROCESSING", "Reserve", ...));

        // If crash happens here, ALL events are lost
        template.sendAll(events);
    }
}
```

**Correct (log immediately after each step using ProcessLogger):**

```java
@Service
public class OrderService {
    private final EventLogTemplate template;

    public OrderService(EventLogTemplate template) {
        this.template = template;
    }

    public void processOrder(Order order) {
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .addIdentifier("orderId", order.getId());

        process.processStart("Processing order " + order.getId(), "INITIATED");

        var validationResult = validateOrder(order);
        process.logStep(1, "Validate Order", EventStatus.SUCCESS, "Order validated", "VALIDATED");

        var reservation = reserveInventory(order);
        process.addIdentifier("reservationId", reservation.getId());
        process.logStep(2, "Reserve Inventory", EventStatus.SUCCESS, "Inventory reserved", "RESERVED");

        process.processEnd(3, EventStatus.SUCCESS, "Order complete", "COMPLETED", totalMs);
    }
}
```

- ProcessLogger is mutable and request-scoped — do NOT share across threads.
- Identifiers added via addIdentifier() stack forward to all subsequent events.
- correlationId/traceId are read from MDC automatically in Spring Boot.
