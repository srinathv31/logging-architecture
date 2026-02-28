---
title: Runbook
---

# Runbook Scenarios

All scenarios use `POST /api/bookings` unless noted. Use the `X-Simulate` header to trigger specific paths.

## Scenario Matrix

| # | Scenario | Endpoint | X-Simulate | Expected |
|---|----------|----------|------------|----------|
| 1 | Happy path booking | `POST /api/bookings` | _(none)_ | Booking created, kennel assigned, all steps SUCCESS |
| 2 | Kennel vendor timeout | `POST /api/bookings` | `kennel-timeout` | Kennel check times out (2s), process ends with FAILURE |
| 3 | Kennel retry | `POST /api/bookings` | `kennel-retry` | First kennel attempt fails, second succeeds with expanded zone |
| 4 | Check-in | `POST /api/bookings/{id}/check-in` | _(none)_ | Pet checked in, kennel assigned via @LogEvent |
| 5 | Agent gate | `POST /api/bookings/{id}/check-in` | `agent-gate` | Kennel flagged for maintenance, agent calls facilities (3s), room cleared |
| 6 | Awaiting approval | `POST /api/bookings/{id}/check-in` | `awaiting-approval` | Returns AWAITING_APPROVAL, requires approve-check-in to complete |
| 7 | Approve check-in | `POST /api/bookings/{id}/approve-check-in` | _(none)_ | Completes the awaiting-approval flow |
| 8 | Check-out | `POST /api/bookings/{id}/check-out` | _(none)_ | Payment processed, pet checked out (uses EventLogUtils approach) |
| 9 | Payment failure | `POST /api/bookings/{id}/check-out` | `payment-failure` | Payment declined, process ends with error |
| 10 | Room service retry | `POST /api/room-service` | `account-retry` | Account lookup fails once, succeeds on retry |

## Running Scenarios

### 1. Happy Path Booking

```bash
curl -X POST http://localhost:8081/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"petId": "PET-001", "ownerId": "OWN-001", "startDate": "2026-03-01", "endDate": "2026-03-05"}'
```

### 2. Kennel Vendor Timeout

```bash
curl -X POST http://localhost:8081/api/bookings \
  -H "Content-Type: application/json" \
  -H "X-Simulate: kennel-timeout" \
  -d '{"petId": "PET-001", "ownerId": "OWN-001", "startDate": "2026-03-01", "endDate": "2026-03-05"}'
```

### 3. Kennel Retry

```bash
curl -X POST http://localhost:8081/api/bookings \
  -H "Content-Type: application/json" \
  -H "X-Simulate: kennel-retry" \
  -d '{"petId": "PET-001", "ownerId": "OWN-001", "startDate": "2026-03-01", "endDate": "2026-03-05"}'
```

### 4-7. Check-in Flow

```bash
# Create a booking first, then use the returned booking ID

# Normal check-in
curl -X POST http://localhost:8081/api/bookings/{id}/check-in

# Agent gate
curl -X POST http://localhost:8081/api/bookings/{id}/check-in \
  -H "X-Simulate: agent-gate"

# Awaiting approval
curl -X POST http://localhost:8081/api/bookings/{id}/check-in \
  -H "X-Simulate: awaiting-approval"

# Approve
curl -X POST http://localhost:8081/api/bookings/{id}/approve-check-in
```

### 8-9. Check-out Flow

```bash
# Normal check-out
curl -X POST http://localhost:8081/api/bookings/{id}/check-out

# Payment failure
curl -X POST http://localhost:8081/api/bookings/{id}/check-out \
  -H "X-Simulate: payment-failure"
```

### 10. Room Service Retry

```bash
curl -X POST http://localhost:8081/api/room-service \
  -H "Content-Type: application/json" \
  -H "X-Simulate: account-retry" \
  -d '{"bookingId": "{id}", "service": "grooming"}'
```
