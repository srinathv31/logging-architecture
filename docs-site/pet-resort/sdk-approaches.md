---
title: SDK Approaches
---

# SDK Approaches Comparison

The Pet Resort API demonstrates both Event Log Java SDK approaches. Use this guide to choose the right one for your use case.

## Overview

| Approach | Where Used | When to Use |
|----------|-----------|-------------|
| **ProcessLogger** | `BookingService.createBooking()`, `checkIn()`, `approveCheckIn()`, `checkOut()`, `RoomServiceService.fulfillRoomService()` | Multi-step processes with branching, retries, or approval gates |
| **@LogEvent** | `BookingService.getBooking()`, `PaymentService.processPayment()`, `PetService.getPet()`, `OwnerService.getOwner()`, `KennelService.assignKennel()` | Simple single-step operations needing minimal configuration |

> **Note:** `checkOut()` demonstrates ProcessLogger features not shown elsewhere: `withBatchId()`, `withIdempotencyKey()`, `withRequestPayload()` / `withResponsePayload()` with **PII/PCI masking** via `EventLogUtils.maskLast4()`, per-step HTTP context (`withEndpoint()`, `withHttpMethod()`, `withHttpStatusCode()`), per-step `withTargetSystem()`, and `withErrorCode()` / `withErrorMessage()` on FAILURE steps. It also powers the **trace-level retry** pattern ([Scenario 12](/pet-resort/runbook#_12-trace-level-retry-checkout)): two HTTP requests sharing the same `traceId`, producing a single unified trace with both the failure and success timelines.

## ProcessLogger (Fluent Multi-Step)

Best for multi-step processes where you want a fluent API with automatic MDC propagation.

```java
ProcessLogger process = template.forProcess("PET_BOARDING_CHECK_IN")
    .addIdentifier("bookingId", booking.getId());

process.logStep(1, "Verify Booking", EventStatus.SUCCESS, "Booking verified");

// Add data as you learn it
process.addIdentifier("kennelId", kennel.getId());
process.logStep(2, "Assign Kennel", EventStatus.SUCCESS, "Kennel K-101 assigned");

process.logProcessEnd(3, EventStatus.SUCCESS, "Check-in completed", totalMs);
```

**Use when:**
- Process has 3+ steps
- Steps have conditional branching or retries
- You need progressive identifier accumulation
- Approval gates are involved

### HTTP Payloads with PII Masking

The `checkOut()` payment step demonstrates capturing outbound HTTP calls with masked sensitive data. Since `withEndpoint()`, `withHttpMethod()`, and `withHttpStatusCode()` are **one-shot** fields (cleared after each emit), you can set different HTTP context per step:

```java
// Step 2: outbound Stripe call — per-step HTTP context + PCI masking
processLogger
    .withTargetSystem("STRIPE")
    .withEndpoint("/v1/charges")
    .withHttpMethod(HttpMethod.POST)
    .withHttpStatusCode(200)
    .withIdempotencyKey(idempotencyKey)
    .withRequestPayload("{\"amount\":" + amount
        + ",\"card_last4\":\"" + EventLogUtils.maskLast4(cardLast4) + "\"...}")
    .withResponsePayload("{\"charge_id\":\"ch_...\",\"status\":\"succeeded\"}")
    .addIdentifier("card_number_last4", EventLogUtils.maskLast4(cardLast4))
    .logStep(2, "Process Payment", EventStatus.SUCCESS, "Payment processed", "PAYMENT_SUCCESS");
```

Always use `EventLogUtils.maskLast4()` for card numbers, SSNs, or any PCI/PII field that appears in request or response payloads.

## @LogEvent (Annotation-Based)

Best for simple operations where you just want method-level logging with minimal code.

```java
@LogEvent(process = "PET_BOARDING", step = 1, name = "Get Booking")
public Booking getBooking(String bookingId) {
    return bookingStore.findById(bookingId)
        .orElseThrow(() -> new BookingNotFoundException(bookingId));
}
```

**Use when:**
- Single-step operation (one method = one event)
- No complex branching or retries
- You want zero logging boilerplate
- Read operations or simple CRUD
