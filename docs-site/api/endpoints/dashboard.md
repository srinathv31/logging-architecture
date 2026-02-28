---
title: Dashboard
---

# Dashboard Statistics

## Get Stats

`GET /v1/dashboard/stats`

Returns aggregate statistics for the dashboard overview: total traces, total unique accounts, total events, trace-level success rate, and a list of all distinct system names.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | ISO 8601 datetime | — | Only include events on or after this time |
| `endDate` | ISO 8601 datetime | — | Only include events on or before this time |

### Response (200)

```json
{
  "totalTraces": 500,
  "totalAccounts": 120,
  "totalEvents": 15000,
  "successRate": 95.5,
  "systemNames": ["EXPERIAN", "MOBILE_APP", "HR_PORTAL"]
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `totalTraces` | Count of distinct `traceId` values |
| `totalAccounts` | Count of distinct non-null `accountId` values |
| `totalEvents` | Total event count |
| `successRate` | Percentage of traces with zero `FAILURE` events (0-100, rounded to 2 decimal places). Returns `100` when there are no traces |
| `systemNames` | Distinct `targetSystem` values across all matching events |
