---
title: Events
---

# Events

## Create Event

`POST /v1/events`

Create a single event log entry.

### Request Body

```json
{
  "correlationId": "corr-auth-20260301-abc123",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "applicationId": "auth-user-service",
  "targetSystem": "EXPERIAN",
  "originatingSystem": "MOBILE_APP",
  "processName": "ADD_AUTH_USER",
  "eventType": "STEP",
  "eventStatus": "SUCCESS",
  "stepSequence": 1,
  "stepName": "Validate auth user identity",
  "summary": "Validated authorized user identity",
  "result": "IDENTITY_VERIFIED",
  "identifiers": { "auth_user_id": "AU-111222" },
  "eventTimestamp": "2026-03-01T10:15:30.123Z"
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `correlationId` | string | Yes | Correlation identifier (1-200 chars) |
| `accountId` | string | No | Account identifier (max 64 chars) |
| `traceId` | string | Yes | W3C trace ID (32 lowercase hex chars) |
| `spanId` | string | No | Span ID (16 lowercase hex chars) |
| `parentSpanId` | string | No | Parent span ID (16 lowercase hex chars) |
| `spanLinks` | string[] | No | Array of linked span IDs |
| `batchId` | string | No | Batch identifier (max 200 chars) |
| `applicationId` | string | Yes | Application identifier (1-200 chars) |
| `targetSystem` | string | Yes | Target system name (1-200 chars) |
| `originatingSystem` | string | Yes | Originating system name (1-200 chars) |
| `processName` | string | Yes | Process name (1-510 chars) |
| `stepSequence` | integer | No | Step sequence number (>= 0) |
| `stepName` | string | No | Step name (max 510 chars) |
| `eventType` | enum | Yes | `PROCESS_START`, `STEP`, `PROCESS_END`, `ERROR` |
| `eventStatus` | enum | Yes | `SUCCESS`, `FAILURE`, `IN_PROGRESS`, `SKIPPED`, `WARNING` |
| `identifiers` | object | Yes | Key-value pairs for business identifiers |
| `summary` | string | Yes | Human-readable summary |
| `result` | string | Yes | Result code (1-2048 chars) |
| `metadata` | object | No | Additional metadata |
| `eventTimestamp` | ISO datetime | Yes | When the event occurred |
| `executionTimeMs` | integer | No | Execution time in milliseconds |
| `endpoint` | string | No | HTTP endpoint (max 510 chars) |
| `httpMethod` | enum | No | HTTP method |
| `httpStatusCode` | integer | No | HTTP status code (100-599) |
| `errorCode` | string | No | Error code (max 100 chars) |
| `errorMessage` | string | No | Error message (max 2048 chars) |
| `requestPayload` | string | No | Request payload for debugging |
| `responsePayload` | string | No | Response payload for debugging |
| `idempotencyKey` | string | No | Idempotency key (max 128 chars) |

### Response (201)

```json
{
  "success": true,
  "executionIds": ["exec-abc123"],
  "correlationId": "corr-auth-20260301-abc123"
}
```

---

## Query by Account

`GET /v1/events/account/:accountId`

Query event logs for a specific account with filtering and pagination.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Results per page (max 100) |
| `startDate` | ISO datetime | — | Filter start (must pair with endDate) |
| `endDate` | ISO datetime | — | Filter end (must pair with startDate) |
| `processName` | string | — | Filter by process |
| `eventStatus` | enum | — | Filter by status |
| `includeLinked` | boolean | `false` | Include events from linked correlations |

### Response (200)

```json
{
  "accountId": "AC-1234567890",
  "events": [],
  "totalCount": 42,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

---

## Query by Trace

`GET /v1/events/trace/:traceId`

Returns paginated events for a distributed trace with aggregate metadata.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `200` | Results per page (max 500) |

### Response (200)

```json
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "events": [],
  "systemsInvolved": ["system-a", "system-b"],
  "totalDurationMs": 5000,
  "totalCount": 12,
  "page": 1,
  "pageSize": 200,
  "hasMore": false,
  "statusCounts": {
    "success": 8,
    "failure": 1,
    "inProgress": 2,
    "skipped": 1,
    "warning": 0
  },
  "processName": "ADD_AUTH_USER",
  "accountId": "AC-1234567890",
  "startTime": "2026-03-01T10:00:00.000Z",
  "endTime": "2026-03-01T10:00:05.000Z"
}
```

::: tip Pet Resort Example
Scenario 12 ([Trace-Level Retry](/pet-resort/runbook#_12-trace-level-retry-checkout)) demonstrates this endpoint with a real multi-attempt trace. Two checkout requests share the same `traceId` — the first fails (payment decline, 422) and the second succeeds (200). Querying `GET /v1/events/trace/{traceId}` returns all 14 events from both attempts as a single timeline, with `statusCounts` reflecting both the failure and success tallies.
:::

---

## Query by Correlation ID

`GET /v1/events/correlation/:correlationId`

Get all events associated with a correlation ID.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Results per page |

### Response (200)

```json
{
  "correlationId": "corr-auth-20260301-abc123",
  "accountId": "AC-1234567890",
  "events": [],
  "isLinked": true,
  "totalCount": 5,
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```

---

## Account Summary

`GET /v1/events/account/:accountId/summary`

Get aggregated account summary with recent events and errors.

### Response (200)

```json
{
  "summary": {
    "accountId": "AC-1234567890",
    "firstEventAt": "2026-01-01T10:00:00.000Z",
    "lastEventAt": "2026-03-01T10:00:00.000Z",
    "totalEvents": 150,
    "totalProcesses": 12,
    "errorCount": 3,
    "lastProcess": "ADD_AUTH_USER",
    "systemsTouched": ["EXPERIAN", "MOBILE_APP"],
    "correlationIds": ["corr-1", "corr-2"]
  },
  "recentEvents": [],
  "recentErrors": []
}
```

---

## Text Search

`POST /v1/events/search/text`

Constrained text search with required account/process filters and bounded date windows.

### Request Body

```json
{
  "query": "identity verified",
  "accountId": "AC-1234567890",
  "startDate": "2026-02-01T00:00:00Z",
  "endDate": "2026-03-01T00:00:00Z",
  "page": 1,
  "pageSize": 20
}
```

**Validation rules:**
- Either `accountId` **or** `processName` is required
- If date range provided: both `startDate` and `endDate` required
- Date window cannot exceed **30 days**

### Response (200)

```json
{
  "query": "identity verified",
  "events": [],
  "totalCount": 5,
  "page": 1,
  "pageSize": 20
}
```

---

## Lookup Events

`POST /v1/events/lookup`

Fast structured event lookup by account/process with optional filters.

### Request Body

```json
{
  "accountId": "AC-1234567890",
  "eventStatus": "FAILURE",
  "startDate": "2026-02-01T00:00:00Z",
  "endDate": "2026-03-01T00:00:00Z",
  "page": 1,
  "pageSize": 20
}
```

**Validation rules:**
- Either `accountId` **or** `processName` is required
- Date window cannot exceed **30 days**

### Response (200)

```json
{
  "events": [],
  "totalCount": 3,
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```
