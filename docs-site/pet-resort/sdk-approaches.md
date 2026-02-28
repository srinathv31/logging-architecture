---
title: SDK Approaches
---

# SDK Approaches Comparison

The Pet Resort API demonstrates all three Event Log Java SDK approaches. Use this guide to choose the right one for your use case.

## Overview

| Approach | Where Used | When to Use |
|----------|-----------|-------------|
| **ProcessLogger** | `BookingService.createBooking()`, `checkIn()`, `approveCheckIn()`, `RoomServiceService.fulfillRoomService()` | Multi-step processes with branching, retries, or approval gates |
| **EventLogUtils** | `BookingService.checkOut()`, `PaymentService.processPayment()` | Full manual control over event construction and span management |
| **@LogEvent** | `BookingService.getBooking()`, `PetService.getPet()`, `OwnerService.getOwner()`, `KennelService.assignKennel()` | Simple single-step operations needing minimal configuration |

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

## EventLogUtils (Manual Control)

Best when you need full control over event construction, span IDs, and timing.

```java
String spanId = EventLogUtils.createSpanId();
long startMs = System.currentTimeMillis();

// ... do work ...

EventLogEntry event = EventLogUtils.step(correlationId, traceId, "CHECKOUT", 1, "Process Payment")
    .spanId(spanId)
    .parentSpanId(parentSpanId)
    .applicationId("pet-resort-api")
    .targetSystem("PAYMENT_GATEWAY")
    .originatingSystem("PET_RESORT")
    .eventStatus(EventStatus.SUCCESS)
    .summary("Payment of $" + amount + " processed")
    .result("PAYMENT_APPROVED")
    .executionTimeMs(System.currentTimeMillis() - startMs)
    .build();

eventLog.log(event);
```

**Use when:**
- You need precise span ID management
- Fork-join patterns with span links
- Custom timing calculations
- Integration with external trace contexts

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
