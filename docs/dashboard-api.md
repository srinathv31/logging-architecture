# Dashboard-Ready API Endpoints

API endpoints designed for the dashboard frontend. These endpoints provide pre-aggregated data so the dashboard can consume everything through the API instead of making direct database queries.

> **Swagger UI:** All endpoints are documented at `/docs` when the API is running.

---

## GET /v1/traces

List traces grouped by `trace_id` with aggregate summaries. Powers the dashboard's trace list view.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-based) |
| `page_size` | integer | `20` | Results per page (max 100) |
| `start_date` | ISO 8601 datetime | — | Filter traces with events on or after this time |
| `end_date` | ISO 8601 datetime | — | Filter traces with events on or before this time |
| `process_name` | string | — | Filter by process name |
| `event_status` | enum | — | Filter by event status (`SUCCESS`, `FAILURE`, `IN_PROGRESS`, `SKIPPED`) |
| `account_id` | string | — | Filter by account ID |

### Response

```json
{
  "traces": [
    {
      "trace_id": "abc-123",
      "event_count": 12,
      "has_errors": false,
      "latest_status": "SUCCESS",
      "duration_ms": 5000,
      "process_name": "Onboarding",
      "account_id": "ACC-123",
      "start_time": "2024-01-01T10:00:00.000Z",
      "end_time": "2024-01-01T10:00:05.000Z"
    }
  ],
  "total_count": 42,
  "page": 1,
  "page_size": 20,
  "has_more": true
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `event_count` | Total number of events in the trace |
| `has_errors` | `true` if any event has `event_status = 'FAILURE'` |
| `latest_status` | Status of the most recent event by timestamp |
| `duration_ms` | Milliseconds between first and last event (`null` if single event) |
| `process_name` | From the first `PROCESS_START` event, or `null` if none |
| `account_id` | First non-null `account_id` across all events in the trace |
| `start_time` | Timestamp of the earliest event |
| `end_time` | Timestamp of the latest event |

---

## GET /v1/dashboard/stats

Aggregate statistics for the dashboard overview panel.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start_date` | ISO 8601 datetime | — | Only include events on or after this time |
| `end_date` | ISO 8601 datetime | — | Only include events on or before this time |

### Response

```json
{
  "total_traces": 500,
  "total_accounts": 120,
  "total_events": 15000,
  "success_rate": 95.5,
  "system_names": ["system-a", "system-b"]
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `total_traces` | Count of distinct `trace_id` values |
| `total_accounts` | Count of distinct non-null `account_id` values |
| `total_events` | Total event count |
| `success_rate` | Percentage of traces with zero `FAILURE` events, rounded to 2 decimal places. Returns `100` when there are no traces |
| `system_names` | Distinct `target_system` values across all matching events |

---

## GET /v1/events/trace/:traceId (Enriched)

The existing trace-detail endpoint now returns additional aggregate metadata alongside the paginated event list. These fields power the dashboard's trace-detail header.

### New Response Fields

```json
{
  "trace_id": "abc-123",
  "events": [],
  "systems_involved": ["system-a"],
  "total_duration_ms": 5000,
  "total_count": 12,
  "page": 1,
  "page_size": 200,
  "has_more": false,
  "status_counts": {
    "success": 8,
    "failure": 1,
    "in_progress": 2,
    "skipped": 1
  },
  "process_name": "Onboarding",
  "account_id": "ACC-123",
  "start_time": "2024-01-01T10:00:00.000Z",
  "end_time": "2024-01-01T10:00:05.000Z"
}
```

| Field | Description |
|-------|-------------|
| `status_counts` | Breakdown of events by status across the entire trace (not just the current page) |
| `process_name` | From the first `PROCESS_START` event, or `null` |
| `account_id` | First non-null `account_id` in the trace |
| `start_time` | ISO timestamp of the earliest event, or `null` if no events |
| `end_time` | ISO timestamp of the latest event, or `null` if no events |

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
