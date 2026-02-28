---
title: Traces
---

# Traces

## List Traces

`GET /v1/traces`

Returns a paginated list of traces grouped by `traceId`. Each trace summary includes event count, error presence, latest status, duration, process name, and account ID. Powers the dashboard's trace list view.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-based) |
| `pageSize` | integer | `20` | Results per page (max 100) |
| `startDate` | ISO 8601 datetime | — | Filter traces with events on or after this time |
| `endDate` | ISO 8601 datetime | — | Filter traces with events on or before this time |
| `processName` | string | — | Filter by process name |
| `eventStatus` | enum | — | Filter by event status (`SUCCESS`, `FAILURE`, `IN_PROGRESS`, `SKIPPED`, `WARNING`) |
| `accountId` | string | — | Filter by account ID (max 64 chars) |

### Response (200)

```json
{
  "traces": [
    {
      "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
      "eventCount": 12,
      "hasErrors": false,
      "latestStatus": "SUCCESS",
      "durationMs": 5000,
      "processName": "ADD_AUTH_USER",
      "accountId": "AC-1234567890",
      "startTime": "2026-03-01T10:00:00.000Z",
      "endTime": "2026-03-01T10:00:05.000Z"
    }
  ],
  "totalCount": 42,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `traceId` | W3C Trace Context identifier |
| `eventCount` | Total number of events in the trace |
| `hasErrors` | `true` if any event has `eventStatus = 'FAILURE'` |
| `latestStatus` | Status of the most recent event by timestamp |
| `durationMs` | Milliseconds between first and last event (`null` if single event) |
| `processName` | From the first `PROCESS_START` event, or `null` |
| `accountId` | First non-null `accountId` across all events in the trace |
| `startTime` | Timestamp of the earliest event |
| `endTime` | Timestamp of the latest event |

### Database Index

A covering index supports the `GROUP BY trace_id` queries:

```sql
CREATE INDEX [ix_event_log_trace_timestamp]
  ON [event_log] ([trace_id], [event_timestamp])
  INCLUDE ([process_name], [account_id], [event_status], [target_system])
  WHERE [is_deleted] = 0;
```
