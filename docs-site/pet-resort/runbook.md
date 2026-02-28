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
| 8 | Check-out | `POST /api/bookings/{id}/check-out` | _(none)_ | Payment processed, pet checked out |
| 9 | Payment failure | `POST /api/bookings/{id}/check-out` | `payment-failure` | Payment declined, process ends with error |
| 10 | Room service retry | `POST /api/room-service` | `account-retry` | Account lookup fails once, succeeds on retry |
| 11 | Vet warning | `POST /api/bookings` | `vet-warning` | Booking succeeds, vet check logs WARNING |
| 12 | Trace-level retry checkout | `POST /api/bookings/{id}/check-out` | `payment-failure` (attempt 1 only) | Same traceId across both requests; attempt 1 FAILURE (422), attempt 2 SUCCESS (200); single trace query returns full retry timeline |

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

**What to Look For — Scenario 8 (Check-out):**

- The payment step (step 2) captures the full HTTP round-trip to Stripe: `endpoint` = `/v1/charges`, `httpMethod` = `POST`, `httpStatusCode` = `200`
- `requestPayload` contains the charge request with card numbers masked via `EventLogUtils.maskLast4()` — you should see `***` instead of actual card digits
- `responsePayload` captures the Stripe charge response (charge ID, status, amount)
- `idempotencyKey` is recorded on the payment step for debugging duplicate-charge scenarios
- The inbound API endpoint (`/api/bookings/{id}/check-out`) is set on `processStart`, while the outbound Stripe endpoint (`/v1/charges`) is set per-step — demonstrating one-shot HTTP field behavior

**What to Look For — Scenario 9 (Payment failure):**

- The payment step logs with `EventStatus.FAILURE` and captures `endpoint` = `/v1/charges`, `httpMethod` = `POST`, `httpStatusCode` = `402`
- `errorCode` = `PAYMENT_DECLINED` and `errorMessage` contain the decline reason
- The process ends with `httpStatusCode` = `422` on the `processEnd` step, reflecting the API response back to the caller

### 10. Room Service Retry

```bash
curl -X POST http://localhost:8081/api/room-service \
  -H "Content-Type: application/json" \
  -H "X-Simulate: account-retry" \
  -d '{"bookingId": "{id}", "service": "grooming"}'
```

### 11. Vet Warning

```bash
curl -X POST http://localhost:8081/api/bookings \
  -H "Content-Type: application/json" \
  -H "X-Simulate: vet-warning" \
  -d '{"petId": "PET-003", "checkInDate": "2026-04-10", "checkOutDate": "2026-04-14"}'
```

The booking succeeds with HTTP 201, but the veterinary health check step logs with `EventStatus.WARNING` instead of `SUCCESS`. This simulates an expired avian vaccination detected during the vet screening — the bird is approved for boarding with a monitoring advisory. Useful for verifying that WARNING status renders correctly in the dashboard and event queries.

### 12. Trace-Level Retry Checkout

Two checkout requests share the same `traceId` — the first fails (payment decline) and the second succeeds. This produces a single unified trace containing both attempt timelines.

```bash
# Pre-generate shared IDs so both attempts land in the same trace
TRACE_ID="$(uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]')"
CORRELATION_ID="corr-checkout-retry-$(date +%s)"

# Attempt 1 — payment failure (expects HTTP 422)
curl -X POST http://localhost:8081/api/bookings/{id}/check-out \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: $TRACE_ID" \
  -H "X-Correlation-Id: $CORRELATION_ID" \
  -H "X-Simulate: payment-failure" \
  -d '{"paymentAmount":389.99,"cardNumberLast4":"5555"}'

# Attempt 2 — successful retry with same traceId (expects HTTP 200)
curl -X POST http://localhost:8081/api/bookings/{id}/check-out \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: $TRACE_ID" \
  -H "X-Correlation-Id: $CORRELATION_ID" \
  -d '{"paymentAmount":389.99,"cardNumberLast4":"1234"}'

# Query the trace — both attempts appear in a single timeline
curl http://localhost:8080/v1/events/trace/$TRACE_ID
```

**What to Look For — Scenario 12 (Trace-Level Retry):**

- The trace query returns **14 events** — 7 from the failed attempt and 7 from the successful retry — all under one `traceId`
- **Attempt 1 (FAILURE)**: `processStart` → steps 1-5 → `processEnd` with `httpStatusCode` = `422`. The payment step (step 2) shows `endpoint` = `/v1/charges`, `httpMethod` = `POST`, `httpStatusCode` = `402`, `errorCode` = `PAYMENT_DECLINED`
- **Attempt 2 (SUCCESS)**: `processStart` → steps 1-5 → `processEnd` with `httpStatusCode` = `200`. The payment step (step 2) shows `httpStatusCode` = `200` with successful charge response in `responsePayload`
- Both attempts share the same `traceId` and `correlationId` but have different `spanId` values, distinguishing the two HTTP requests within the trace
- `statusCounts` in the trace response reflects both attempts — you'll see counts for both FAILURE and SUCCESS statuses

::: tip Trace-Level vs Correlation-Level Retry
**Scenario 12** (this scenario) uses the same `traceId` across both HTTP requests. A single `GET /v1/events/trace/{traceId}` query returns the full retry timeline — ideal when you want one trace to represent the entire retry sequence.

**Scenario 8** (in `demo-runbook.sh`) uses the same `correlationId` but different `traceIds` for each attempt. You need `GET /v1/events/correlation/{correlationId}` to see both attempts — better when each attempt should be an independent trace that can be analyzed separately.

Choose **trace-level retry** when retries are automatic (circuit breakers, SDK retry policies) and you want a single trace view. Choose **correlation-level retry** when retries are user-initiated or span long time gaps.
:::

**Expected Events (14 total):**

| Attempt | Step | Step Name | Status |
|---------|------|-----------|--------|
| 1 | processStart | — | IN_PROGRESS |
| 1 | 1 | Verify Booking | SUCCESS |
| 1 | 2 | Process Payment | FAILURE |
| 1 | 3 | Update Booking Status | SKIPPED |
| 1 | 4 | Release Kennel | SKIPPED |
| 1 | 5 | Send Confirmation | SKIPPED |
| 1 | processEnd | — | FAILURE |
| 2 | processStart | — | IN_PROGRESS |
| 2 | 1 | Verify Booking | SUCCESS |
| 2 | 2 | Process Payment | SUCCESS |
| 2 | 3 | Update Booking Status | SUCCESS |
| 2 | 4 | Release Kennel | SUCCESS |
| 2 | 5 | Send Confirmation | SUCCESS |
| 2 | processEnd | — | SUCCESS |
