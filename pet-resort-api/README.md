# Pet Resort API — Event Log SDK Reference Implementation

Spring Boot 3.4 application demonstrating both Event Log Java SDK logging approaches in a realistic pet boarding scenario.

## What This Demonstrates

- **Two SDK approaches**: ProcessLogger (fluent multi-step) and @LogEvent (annotation-based)
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

## Runbook Scenarios

All scenarios use `POST /api/bookings` unless noted. Use the `X-Simulate` header to trigger specific paths.

| # | Scenario | Endpoint | X-Simulate | Expected |
|---|----------|----------|------------|----------|
| 1 | Happy path booking | `POST /api/bookings` | _(none)_ | Booking created, kennel assigned, all steps SUCCESS |
| 2 | Kennel vendor timeout | `POST /api/bookings` | `kennel-timeout` | Kennel check times out (2s), process ends with FAILURE |
| 3 | Kennel retry | `POST /api/bookings` | `kennel-retry` | First kennel attempt fails, second succeeds with expanded zone |
| 4 | Check-in | `POST /api/bookings/{id}/check-in` | _(none)_ | Pet checked in, kennel assigned via @LogEvent |
| 5 | Agent gate | `POST /api/bookings/{id}/check-in` | `agent-gate` | Kennel flagged for maintenance, agent calls facilities (3s), room cleared |
| 6 | Awaiting approval | `POST /api/bookings/{id}/check-in` | `awaiting-approval` | Returns AWAITING_APPROVAL, requires approve-check-in to complete |
| 7 | Approve check-in | `POST /api/bookings/{id}/approve-check-in` | _(none)_ | Completes the awaiting-approval flow |
| 8 | Check-out | `POST /api/bookings/{id}/check-out` | _(none)_ | Payment processed, pet checked out |
| 9 | Payment failure | `POST /api/bookings/{id}/check-out` | `payment-failure` | Payment declined, process ends with error |
| 10 | Room service retry | `POST /api/room-service` | `account-retry` | Account lookup fails once, succeeds on retry |

## SDK Approaches Used

| Approach | Where Used | When to Use |
|----------|-----------|-------------|
| **ProcessLogger** | `BookingService.createBooking()`, `checkIn()`, `approveCheckIn()`, `checkOut()`, `RoomServiceService.fulfillRoomService()` | Multi-step processes with branching, retries, or approval gates |
| **@LogEvent** | `BookingService.getBooking()`, `PaymentService.processPayment()`, `PetService.getPet()`, `OwnerService.getOwner()`, `KennelService.assignKennel()` | Simple single-step operations needing minimal configuration |

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
├── exception/
│   ├── GlobalExceptionHandler.java   # @ControllerAdvice error handling
│   ├── BookingConflictException.java
│   ├── BookingNotFoundException.java
│   ├── KennelVendorTimeoutException.java
│   ├── OwnerNotFoundException.java
│   ├── PaymentFailedException.java
│   └── PetNotFoundException.java
├── model/
│   ├── Booking.java, BookingResponse.java, BookingStatus.java
│   ├── CreateBookingRequest.java, CheckInRequest.java, CheckOutRequest.java
│   ├── Owner.java, Pet.java, PetSpecies.java
│   └── RoomServiceRequest.java, RoomServiceResponse.java
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
