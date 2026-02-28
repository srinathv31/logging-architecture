---
title: Pet Resort
---

# Pet Resort API — Reference Implementation

Spring Boot 3.4 application demonstrating both Event Log Java SDK logging approaches in a realistic pet boarding scenario.

## What This Demonstrates

- **Two SDK approaches**: ProcessLogger (fluent multi-step) and @LogEvent (annotation-based)
- **Fork-join with span links**: parallel kennel/vet checks linked to a downstream decision step
- **MDC correlation propagation**: inbound correlation/trace IDs flow through all child events
- **Retry and error handling**: kennel timeout, kennel retry, payment failure, and trace-level retry (same traceId across HTTP requests) vs correlation-level retry (same correlationId, different traceIds)
- **Awaiting approval workflows**: check-in with `withAwaitCompletion()` requiring explicit approval
- **HTTP request/response logging with PII masking**: `withRequestPayload()` / `withResponsePayload()` capture full HTTP payloads with sensitive fields masked via `EventLogUtils.maskLast4()` — demonstrated in the check-out payment flow (Scenario 8)
- **Idempotency keys**: correlation IDs generated via `EventLogUtils.createCorrelationId()`

## HTTP Logging with PII/PCI Masking

The check-out payment flow (Scenario 8) showcases per-step HTTP context with masked PII/PCI data. When the service calls Stripe to process a payment, it captures the full HTTP round-trip on that step:

```java
processLogger
    .withTargetSystem("STRIPE")
    .withEndpoint("/v1/charges")              // outbound Stripe endpoint
    .withHttpMethod(HttpMethod.POST)          // per-step HTTP method (one-shot)
    .withHttpStatusCode(200)                  // per-step status code (one-shot)
    .withIdempotencyKey(idempotencyKey)       // payment safety
    .withRequestPayload("{\"amount\":" + amount
        + ",\"currency\":\"USD\",\"card_last4\":\""
        + EventLogUtils.maskLast4(cardLast4)  // PCI: mask card number
        + "\"...}")
    .withResponsePayload("{\"charge_id\":\"ch_...\"...}")
    .addIdentifier("card_number_last4", EventLogUtils.maskLast4(cardLast4))
    .logStep(2, "Process Payment", EventStatus.SUCCESS,
        "Payment processed via STRIPE", "PAYMENT_SUCCESS");
```

**Key points:**

- **Per-step HTTP context** — `withEndpoint()`, `withHttpMethod()`, and `withHttpStatusCode()` are one-shot fields, so they apply only to the next emit and then clear. This lets you set different HTTP context per step (e.g., the inbound API endpoint on `processStart()`, then the outbound Stripe endpoint on the payment step).
- **PCI masking** — card numbers in `requestPayload` are masked via `EventLogUtils.maskLast4()`, ensuring sensitive data never reaches the event log in cleartext.
- **Idempotency** — `withIdempotencyKey()` records the payment idempotency key for debugging duplicate-charge scenarios.
- **Error path** — the payment failure scenario (Scenario 9) captures the same HTTP context with `withHttpStatusCode(402)` and `withErrorCode("PAYMENT_DECLINED")`.

## Prerequisites

- Java 21+
- Event Log API running on `localhost:8080`

## Running Locally

```bash
mvn spring-boot:run
```

App starts on [http://localhost:8081](http://localhost:8081).

Ensure the Event Log API is running first (`cd ../api && pnpm dev`).

## Project Structure

```
src/main/java/com/example/petresort/
├── PetResortApplication.java
├── config/
│   └── EventLogConfig.java          # SimulateHeaderFilter, custom beans
├── controller/
│   ├── BookingController.java        # /api/bookings — CRUD + check-in/out
│   ├── OwnerController.java          # /api/owners
│   ├── PetController.java            # /api/pets
│   └── RoomServiceController.java    # /api/room-service
├── service/
│   ├── BookingService.java           # ProcessLogger + @LogEvent
│   ├── KennelService.java            # @LogEvent annotation approach
│   ├── OwnerService.java             # @LogEvent annotation approach
│   ├── PaymentService.java           # @LogEvent annotation approach
│   ├── PetService.java               # @LogEvent annotation approach
│   └── RoomServiceService.java       # ProcessLogger with retry
└── store/
    ├── InMemoryBookingStore.java
    ├── InMemoryOwnerStore.java
    └── InMemoryPetStore.java
```
