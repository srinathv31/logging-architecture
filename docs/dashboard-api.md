# Dashboard-Ready API Endpoints

API endpoints designed for the dashboard frontend. These endpoints provide pre-aggregated data so the dashboard can consume everything through the API instead of making direct database queries.

> **Swagger UI:** All endpoints are documented at `/docs` when the API is running.

---

## GET /v1/traces

List traces grouped by `traceId` with aggregate summaries. Powers the dashboard's trace list view.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-based) |
| `pageSize` | integer | `20` | Results per page (max 100) |
| `startDate` | ISO 8601 datetime | — | Filter traces with events on or after this time |
| `endDate` | ISO 8601 datetime | — | Filter traces with events on or before this time |
| `processName` | string | — | Filter by process name |
| `eventStatus` | enum | — | Filter by event status (`SUCCESS`, `FAILURE`, `IN_PROGRESS`, `SKIPPED`) |
| `accountId` | string | — | Filter by account ID |

### Response

```json
{
  "traces": [
    {
      "traceId": "abc-123",
      "eventCount": 12,
      "hasErrors": false,
      "latestStatus": "SUCCESS",
      "durationMs": 5000,
      "processName": "Onboarding",
      "accountId": "ACC-123",
      "startTime": "2024-01-01T10:00:00.000Z",
      "endTime": "2024-01-01T10:00:05.000Z"
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
| `eventCount` | Total number of events in the trace |
| `hasErrors` | `true` if any event has `event_status = 'FAILURE'` |
| `latestStatus` | Status of the most recent event by timestamp |
| `durationMs` | Milliseconds between first and last event (`null` if single event) |
| `processName` | From the first `PROCESS_START` event, or `null` if none |
| `accountId` | First non-null `accountId` across all events in the trace |
| `startTime` | Timestamp of the earliest event |
| `endTime` | Timestamp of the latest event |

---

## GET /v1/dashboard/stats

Aggregate statistics for the dashboard overview panel.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | ISO 8601 datetime | — | Only include events on or after this time |
| `endDate` | ISO 8601 datetime | — | Only include events on or before this time |

### Response

```json
{
  "totalTraces": 500,
  "totalAccounts": 120,
  "totalEvents": 15000,
  "successRate": 95.5,
  "systemNames": ["system-a", "system-b"]
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `totalTraces` | Count of distinct `traceId` values |
| `totalAccounts` | Count of distinct non-null `accountId` values |
| `totalEvents` | Total event count |
| `successRate` | Percentage of traces with zero `FAILURE` events, rounded to 2 decimal places. Returns `100` when there are no traces |
| `systemNames` | Distinct `targetSystem` values across all matching events |

---

## GET /v1/events/trace/:traceId (Enriched)

The existing trace-detail endpoint now returns additional aggregate metadata alongside the paginated event list. These fields power the dashboard's trace-detail header.

### New Response Fields

```json
{
  "traceId": "abc-123",
  "events": [],
  "systemsInvolved": ["system-a"],
  "totalDurationMs": 5000,
  "totalCount": 12,
  "page": 1,
  "pageSize": 200,
  "hasMore": false,
  "statusCounts": {
    "success": 8,
    "failure": 1,
    "inProgress": 2,
    "skipped": 1
  },
  "processName": "Onboarding",
  "accountId": "ACC-123",
  "startTime": "2024-01-01T10:00:00.000Z",
  "endTime": "2024-01-01T10:00:05.000Z"
}
```

| Field | Description |
|-------|-------------|
| `statusCounts` | Breakdown of events by status across the entire trace (not just the current page) |
| `processName` | From the first `PROCESS_START` event, or `null` |
| `accountId` | First non-null `accountId` in the trace |
| `startTime` | ISO timestamp of the earliest event, or `null` if no events |
| `endTime` | ISO timestamp of the latest event, or `null` if no events |

---

## Database Index

A covering index supports the `GROUP BY trace_id` queries used by `GET /v1/traces`:

```sql
CREATE INDEX [ix_event_log_trace_timestamp]
  ON [event_log] ([trace_id], [event_timestamp])
  INCLUDE ([process_name], [account_id], [event_status], [target_system])
  WHERE [is_deleted] = 0;
```

This index is in `drizzle-mssql/manual/001_indexes.sql` and should be applied manually after migrations.
