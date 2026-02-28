---
title: Batch Operations
---

# Batch Operations

## Batch Create Events

`POST /v1/events/batch`

Batch create event log entries with optional `batchId` and per-item error reporting.

### Request Body

```json
{
  "events": [
    { /* EventLogEntry */ },
    { /* EventLogEntry */ }
  ],
  "batchId": "batch-hr-upload-20260301"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `events` | EventLogEntry[] | Yes | Array of events (min 1 item) |
| `batchId` | string | No | Batch identifier (1-200 chars) |

### Response (201)

```json
{
  "success": true,
  "totalReceived": 10,
  "totalInserted": 9,
  "executionIds": ["exec-1", "exec-2", "..."],
  "correlationIds": ["corr-1", "corr-2", "..."],
  "batchId": "batch-hr-upload-20260301",
  "errors": [
    {
      "index": 4,
      "error": "Validation failed: correlationId is required"
    }
  ]
}
```

The `errors` array contains per-item failures. Successfully inserted events are included in `executionIds`. The `batchId` is only returned if provided in the request.

---

## Get Batch Events

`GET /v1/events/batch/:batchId`

Query event logs for a specific batch with optional status filter and pagination.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Results per page (max 100) |
| `eventStatus` | enum | — | Filter by status |

### Response (200)

```json
{
  "batchId": "batch-hr-upload-20260301",
  "events": [],
  "totalCount": 100,
  "uniqueCorrelationIds": 50,
  "successCount": 45,
  "failureCount": 5,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

---

## Get Batch Summary

`GET /v1/events/batch/:batchId/summary`

Get aggregate statistics for a batch of events.

### Response (200)

```json
{
  "batchId": "batch-hr-upload-20260301",
  "totalProcesses": 50,
  "completed": 45,
  "inProgress": 3,
  "failed": 2,
  "correlationIds": ["corr-1", "corr-2"],
  "startedAt": "2026-03-01T10:00:00.000Z",
  "lastEventAt": "2026-03-01T10:05:30.000Z"
}
```
