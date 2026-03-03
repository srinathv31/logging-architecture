---
title: Three-Layer Error Handling
impact: CRITICAL
impactDescription: incorrect error handling means lost diagnostic context for AI agents and operators
tags: template, error, three-layer, logStep, processEnd, error-method
---

## Three-Layer Error Handling

Three-layer error handling — each produces a different event type:
- Layer 1: withErrorCode().withErrorMessage().logStep(FAILURE) produces a STEP event with step context
- Layer 2: processEnd(FAILURE) produces a PROCESS_END event to formally close the process
- Layer 3: error() produces an ERROR event for unhandled exceptions (step_sequence = null)

**Incorrect (only using error() for all failures — loses step context, not closing process on failure):**

```java
try {
    process.processStart("Processing", "INITIATED");
    reserveInventory(order);
    process.logStep(1, "Reserve Inventory", EventStatus.SUCCESS, "Reserved", "OK");
} catch (Exception e) {
    // BAD: All failures go to error() — no step context, process never closed
    process.error("ERROR", e.getMessage(), "Failed", "FAILED");
}
```

**Correct (three layers of error handling for full diagnostic context):**

```java
ProcessLogger process = template.forProcess("ORDER_PROCESSING")
    .addIdentifier("order_id", orderId);

try {
    process.processStart("Processing order " + orderId, "INITIATED");

    try {
        reserveInventory(order);
        process.logStep(1, "Reserve Inventory", EventStatus.SUCCESS, "Reserved", "OK");
    } catch (OutOfStockException e) {
        // Layer 1: Known error → STEP event (step context preserved)
        process.withErrorCode("OUT_OF_STOCK")
            .withErrorMessage(e.getMessage())
            .logStep(1, "Reserve Inventory", EventStatus.FAILURE, "Out of stock", "FAILED");

        // Layer 2: Close the process → PROCESS_END event
        process.processEnd(2, EventStatus.FAILURE, "Order failed", "FAILED", null);
        throw e;
    }

    process.processEnd(2, EventStatus.SUCCESS, "Order complete", "COMPLETED", totalMs);

} catch (Exception e) {
    // Layer 3: Unhandled exception → ERROR event (step_sequence = null)
    process.error("UNHANDLED_ERROR", e.getMessage(), "Unexpected error", "FAILED");
    throw e;
}
```

| Layer | Method | Event Type | Step Context | Use For |
|-------|--------|-----------|-------------|---------|
| 1 | withErrorCode().logStep(FAILURE) | STEP | Preserved | Known business errors |
| 2 | processEnd(FAILURE) | PROCESS_END | Step sequence only | Formally closing process |
| 3 | error() | ERROR | Always null | Unhandled exceptions only |
