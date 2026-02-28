---
title: Pet Resort
---

# Pet Resort API — Reference Implementation

Spring Boot 3.4 application demonstrating all three Event Log Java SDK logging approaches in a realistic pet boarding scenario.

## What This Demonstrates

- **Three SDK approaches**: ProcessLogger (fluent multi-step), EventLogUtils (manual control), @LogEvent (annotation-based)
- **Fork-join with span links**: parallel kennel/vet checks linked to a downstream decision step
- **MDC correlation propagation**: inbound correlation/trace IDs flow through all child events
- **Retry and error handling**: kennel timeout, kennel retry, payment failure scenarios
- **Awaiting approval workflows**: check-in with `withAwaitCompletion()` requiring explicit approval
- **PII masking**: `EventLogUtils.maskLast4()` for sensitive fields
- **Idempotency keys**: correlation IDs generated via `EventLogUtils.createCorrelationId()`

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
│   ├── BookingService.java           # ProcessLogger + EventLogUtils + @LogEvent
│   ├── KennelService.java            # @LogEvent annotation approach
│   ├── OwnerService.java             # @LogEvent annotation approach
│   ├── PaymentService.java           # EventLogUtils manual builder
│   ├── PetService.java               # @LogEvent annotation approach
│   └── RoomServiceService.java       # ProcessLogger with retry
└── store/
    ├── InMemoryBookingStore.java
    ├── InMemoryOwnerStore.java
    └── InMemoryPetStore.java
```
