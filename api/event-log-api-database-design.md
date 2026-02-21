# Event Log API — Database & Endpoint Technical Design

## Version 1.5 | February 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Indexing Strategy](#indexing-strategy)
3. [Endpoint Reference](#endpoint-reference)
   - [Health](#health)
   - [Event Ingestion](#event-ingestion)
   - [Event Queries](#event-queries)
   - [Lookup](#lookup)
   - [Search Operations](#search-operations)
   - [Batch Operations](#batch-operations)
   - [Correlation Links](#correlation-links)
   - [Process Definitions](#process-definitions)
4. [Pagination Strategy](#pagination-strategy)
5. [Performance Summary](#performance-summary)

---

## Overview

The Event Log API provides centralized logging for credit card business processes, capturing end-to-end account history from origination through servicing. The system is designed for:

- **Write-heavy workload**: ~500k events/year per process, scaling with adoption
- **Read patterns**: Account timeline queries, trace debugging, batch monitoring
- **AI integration**: Full-text and semantic search for context retrieval

### Primary Tables

| Table | Purpose | Expected Volume |
|-------|---------|-----------------|
| `event_logs` | Primary event storage | 500k+ rows/year per process |
| `correlation_links` | Maps correlation_id → account_id | 1 row per process instance |
| `process_definitions` | Process registry | ~50-100 rows |
| `account_timeline_summary` | Pre-aggregated account stats | 1 row per account |

---

## Indexing Strategy

All indexes are managed via manual SQL migration (`drizzle-mssql/manual/001_indexes.sql`) to enable filtered indexes not supported by Drizzle ORM.

### event_logs Indexes

| Index | Columns | Filter | Purpose |
|-------|---------|--------|---------|
| `ix_event_logs_correlation_id` | `(correlation_id, event_timestamp)` | — | Process timeline queries |
| `ix_event_logs_account_id` | `(account_id, event_timestamp DESC)` | `WHERE account_id IS NOT NULL` | Account timeline queries |
| `ix_event_logs_trace_id` | `(trace_id)` | — | Distributed trace lookup |
| `ix_event_logs_process` | `(process_name, event_timestamp)` | — | Process-level analytics |
| `ix_event_logs_timestamp` | `(event_timestamp)` | — | Time-range scans |
| `ix_event_logs_status` | `(event_status, event_timestamp)` | `WHERE event_status = 'FAILURE'` | Error monitoring |
| `ix_event_logs_target_system` | `(target_system, event_timestamp)` | — | System-level analytics |
| `ix_event_logs_idempotency` | `(idempotency_key)` UNIQUE | `WHERE idempotency_key IS NOT NULL` | Deduplication |
| `ix_event_logs_batch_id` | `(batch_id, correlation_id)` | `WHERE batch_id IS NOT NULL` | Batch queries |
| `ix_event_logs_fulltext_key` | `(event_log_id)` UNIQUE | — | Full-text index key |

### Full-Text Index

```sql
CREATE FULLTEXT CATALOG EventLogsCatalog AS DEFAULT;
CREATE FULLTEXT INDEX ON [event_logs] ([summary])
    KEY INDEX [ix_event_logs_fulltext_key]
    WITH CHANGE_TRACKING AUTO;
```

**Why**: Enables O(log n) word lookups via inverted index instead of O(n) table scans with `LIKE`.

### Filtered Index Rationale

| Index | Why Filtered |
|-------|--------------|
| `ix_event_logs_account_id` | `account_id` is NULL during origination (~20% of events). Filtering excludes NULLs from index, reducing size. |
| `ix_event_logs_status` | Only ~5% of events are FAILURE. Full index wastes space on SUCCESS rows never queried by error dashboards. |
| `ix_event_logs_idempotency` | Most events don't use idempotency keys. Sparse index for the ~10% that do. |
| `ix_event_logs_batch_id` | Only batch uploads populate this. ~90% of events have NULL batch_id. |

---

## Endpoint Reference

### Health

#### GET /healthcheck

**Purpose**: Liveness probe for load balancers (F5/ALB).

**Database Operations**: None

**Complexity**: O(1)

**Design Notes**:
- No DB call — always returns `{ status: "ok" }`
- Use for liveness probes where you only need to know the process is running

---

#### GET /healthcheck/ready

**Purpose**: Readiness probe — verifies DB connectivity.

**Database Operations**:
- `SELECT 1` with a 3-second timeout via `Promise.race`

**Complexity**: O(1)

**Design Notes**:
- Returns 200 `{ status: "ready", database: "connected" }` or 503 `{ status: "not_ready", database: "error" }`
- Use for Kubernetes readiness probes and operations dashboards

---

### Event Ingestion

#### POST /v1/events

**Purpose**: Create one or more event log entries.

**Database Operations (single event)**:
1. If `idempotency_key` provided: `SELECT TOP 1` to check existence
2. `INSERT` with `OUTPUT` clause to return `execution_id`

**Database Operations (array of events)**:
1. Collect all `idempotency_key` values from array
2. Single `SELECT ... WHERE idempotency_key IN (...)` to find existing (chunked at 100)
3. Bulk `INSERT` for new entries within a transaction (chunked at 100 rows)
4. If chunk fails, fallback to individual inserts to identify bad rows

**Indexes Used**:
- `ix_event_logs_idempotency` (idempotency check)

**Complexity**: O(1) per single event; O(k + n/chunk) for arrays

**Design Notes**:
- Single event: idempotency check before insert prevents duplicates from retry logic
- Array mode: routes through transactional batch service with per-item error reporting
- Array response includes all unique `correlation_ids` and optional `errors[]` array
- `OUTPUT` clause returns auto-generated fields without separate SELECT

---

#### POST /v1/events/batch

**Purpose**: Batch insert with per-item error reporting.

**Database Operations**:
1. Collect all `idempotency_key` values from request
2. Single `SELECT ... WHERE idempotency_key IN (...)` to find existing
3. Bulk `INSERT` for new entries (chunked at 100 rows)
4. If chunk fails, fallback to individual inserts to identify bad rows

**Indexes Used**:
- `ix_event_logs_idempotency` (bulk existence check)

**Complexity**: O(k) where k = number of unique idempotency keys, plus O(1) per chunk

**Design Notes**:
- Chunking prevents transaction log overflow on large batches
- Fallback to individual inserts only triggers on constraint violations
- Returns partial success with error details per failed row

```
Best case:  1 SELECT + n/100 INSERTs
Worst case: 1 SELECT + n INSERTs (all rows fail bulk insert)
```

---

### Event Queries

#### GET /v1/events/account/{accountId}

**Purpose**: Retrieve event timeline for an account with filtering and pagination.

**Pagination**: `page` (default 1), `page_size` (default 20, max 100)

**Database Operations**:
1. Single query: `SELECT *, COUNT(*) OVER() as _totalCount` with filters, `OFFSET/FETCH`
2. If page is beyond results (offset > 0, no rows returned), fallback `SELECT COUNT(*)` to return accurate total

**Optional**: If `include_linked=true`, subquery joins `correlation_links` to include pre-account events.

**Indexes Used**:
- `ix_event_logs_account_id` (primary filter)
- `ix_event_logs_process` (if `process_name` filter)
- `ix_event_logs_status` (if `event_status=FAILURE` filter)

**Complexity**: O(log n) index seek + O(page_size) fetch

**Query Pattern**:
```sql
-- Single query with COUNT(*) OVER()
SELECT *, CAST(COUNT(*) OVER() AS INT) as _totalCount
FROM event_logs
WHERE account_id = @accountId
  AND is_deleted = 0
  [AND process_name = @processName]
  [AND event_status = @eventStatus]
  [AND event_timestamp >= @startDate]
  [AND event_timestamp <= @endDate]
ORDER BY event_timestamp DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

-- With include_linked
SELECT *, CAST(COUNT(*) OVER() AS INT) as _totalCount
FROM event_logs
WHERE (account_id = @accountId
       OR correlation_id IN (
         SELECT correlation_id FROM correlation_links
         WHERE account_id = @accountId
       ))
  AND is_deleted = 0
ORDER BY event_timestamp DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

---

#### GET /v1/events/correlation/{correlationId}

**Purpose**: Retrieve paginated events for a business process instance.

**Pagination**: `page` (default 1), `page_size` (default 200, max 500)

**Database Operations**:
1. Single query: `SELECT *, COUNT(*) OVER() as _totalCount` filtered by `correlation_id`, ordered by `step_sequence, event_timestamp`, with `OFFSET/FETCH`
2. `SELECT TOP 1` from `correlation_links` to check if linked to account

**Indexes Used**:
- `ix_event_logs_correlation_id`
- `correlation_links` primary key

**Complexity**: O(log n) index seek + O(page_size) fetch + O(1) link check

**Design Notes**:
- Orders by `step_sequence, event_timestamp` to reconstruct process flow
- Returns `is_linked` flag indicating if correlation has been mapped to account
- Default page_size of 200 captures virtually all processes without pagination (typical process has 5-20 steps)

---

#### GET /v1/events/trace/{traceId}

**Purpose**: Retrieve paginated events sharing a distributed trace ID, with aggregate metadata.

**Pagination**: `page` (default 1), `page_size` (default 200, max 500)

**Database Operations**:
1. `SELECT DISTINCT target_system` for `systems_involved` (over full trace, not paginated)
2. `SELECT MIN(event_timestamp), MAX(event_timestamp)` for `total_duration_ms` (over full trace)
3. Paginated data: `SELECT *, COUNT(*) OVER() as _totalCount` with `OFFSET/FETCH`

**Indexes Used**:
- `ix_event_logs_trace_id`

**Complexity**: O(log n) + O(m) for aggregates (m = events in trace, typically 1-10) + O(page_size) fetch

**Design Notes**:
- Trace IDs follow W3C format, propagated via `traceparent` header
- `systems_involved` and `total_duration_ms` are computed over the full trace (not just the current page) via separate SQL aggregation queries
- Duration calculated as `MAX(event_timestamp) - MIN(event_timestamp)` in milliseconds

---

#### GET /v1/events/account/{accountId}/summary

**Purpose**: Retrieve pre-aggregated account statistics plus recent events.

**Database Operations**:
1. `SELECT` from `account_timeline_summary` (single row lookup)
2. `SELECT TOP 10` recent events
3. `SELECT TOP 5` recent errors

**Indexes Used**:
- `account_timeline_summary` primary key
- `ix_event_logs_account_id`
- `ix_event_logs_status` (for errors)

**Complexity**: O(1) for summary + O(log n) for recent events

**Design Notes**:
- `account_timeline_summary` is pre-aggregated, updated via background job or trigger
- Avoids expensive COUNT/aggregation on hot path

---

### Lookup

#### POST /v1/events/lookup

**Purpose**: Fast structured event lookup by account/process with optional date and status filters. Designed for dashboard and agent workflows that need filtered, paginated event lists without full-text search overhead.

**Pagination**: `page` (default 1), `page_size` (default 20, max 100)

**Guardrails**:
- At least one of `account_id` or `process_name` is required
- `start_date` and `end_date` must both be provided or both omitted
- Date window cannot exceed 30 days

**Database Operations**:
1. Single query: `SELECT *, COUNT(*) OVER() as _totalCount` with dynamic filter conditions and `OFFSET/FETCH`

**Indexes Used**:
- `ix_event_logs_account_id` (if `account_id` filter)
- `ix_event_logs_process` (if `process_name` filter)
- `ix_event_logs_status` (if `event_status` filter)

**Complexity**: O(log n) index seek + O(page_size) fetch

**Query Pattern**:
```sql
SELECT *, CAST(COUNT(*) OVER() AS INT) as _totalCount
FROM event_logs
WHERE is_deleted = 0
  [AND account_id = @accountId]
  [AND process_name = @processName]
  [AND event_status = @eventStatus]
  [AND event_timestamp >= @startDate]
  [AND event_timestamp <= @endDate]
ORDER BY event_timestamp DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

**Design Notes**:
- Same query pattern as `getByAccount` but without `include_linked` join or account_id requirement
- Accepts any combination of account_id, process_name, event_status, and date range
- Useful for dashboard grids that filter by process name across all accounts, or by account without the correlation_links join

---

### Search Operations

#### POST /v1/events/search/text

**Purpose**: Constrained full-text search across event summaries.

**Pagination**: `page` (default 1), `page_size` (default 20, max 50)

**Guardrails**:
- At least one of `account_id` or `process_name` is required
- `start_date` and `end_date` must both be provided or both omitted
- Date window cannot exceed 30 days
- Page size capped at 50 (lower than other endpoints to bound full-text query cost)

**Database Operations**:
1. `SELECT COUNT(*)` with `CONTAINS()` predicate (or `LIKE` fallback when full-text is disabled)
2. `SELECT ... WHERE CONTAINS(summary, @query)` with pagination

**Indexes Used**:
- Full-text index on `summary`
- `ix_event_logs_account_id` (if `account_id` filter)
- `ix_event_logs_process` (if `process_name` filter)

**Complexity**: O(log n) via inverted index lookup

**Query Pattern**:
```sql
SELECT * FROM event_logs
WHERE CONTAINS(summary, @formattedQuery)
  AND is_deleted = 0
  [AND account_id = @accountId]
  [AND process_name = @processName]
  [AND event_timestamp >= @startDate]
  [AND event_timestamp <= @endDate]
ORDER BY event_timestamp DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

**Query Formatting**:
```typescript
// Input: "payment failed"
// Output: "payment*" AND "failed*"
function formatFullTextQuery(query: string): string {
  const words = query.trim().split(/\s+/);
  return words.map(w => `"${w}*"`).join(' AND ');
}
```

**Design Notes**:

| Approach | Index Used | Complexity | Query Time (500k rows) |
|----------|------------|------------|------------------------|
| `LIKE '%query%'` | None (table scan) | O(n) | 2-5 seconds |
| `CONTAINS()` | Full-text | O(log n) | 10-50ms |

Full-text index builds an inverted word → row_id mapping:
```
┌─────────────┬─────────────────┐
│ word        │ row_ids         │
├─────────────┼─────────────────┤
│ "payment"   │ [1, 3, 502, ...]│
│ "failed"    │ [3, 89, ...]    │
└─────────────┴─────────────────┘
```

Search for "payment" does binary search on word list (~19 comparisons at 500k rows) instead of scanning all rows.

- **Note**: This endpoint uses 2 queries (separate `COUNT(*)` + data query) because `CONTAINS()` with `COUNT(*) OVER()` can produce inconsistent counts in MSSQL full-text scenarios. All other paginated endpoints use the single-query `COUNT(*) OVER()` pattern.
- Falls back to `LIKE` when `FULLTEXT_ENABLED` env var is not `"true"` (e.g., local dev without full-text catalog)

---

### Batch Operations

#### POST /v1/events/batch/upload

**Purpose**: Upload events with shared `batch_id` for bulk operations (CSV imports, scheduled jobs).

**Database Operations**:
- Same as POST /v1/events/batch, but stamps each event with provided `batch_id`

**Indexes Used**:
- `ix_event_logs_idempotency`

**Complexity**: Same as /batch endpoint

**Design Notes**:
- `batch_id` enables querying/monitoring all events from a single bulk operation
- Each event still gets unique `correlation_id` and `trace_id`

---

#### GET /v1/events/batch/{batchId}

**Purpose**: Paginated query of events in a batch with aggregate statistics.

**Pagination**: `page` (default 1), `page_size` (default 20, max 100)

**Database Operations**:
1. Aggregate query for stats (unfiltered by event_status for overall batch stats):
   ```sql
   SELECT
     COUNT(DISTINCT correlation_id) as unique_correlations,
     COUNT(DISTINCT CASE WHEN event_status = 'SUCCESS' THEN correlation_id END) as success_count,
     COUNT(DISTINCT CASE WHEN event_status = 'FAILURE' THEN correlation_id END) as failure_count
   FROM event_logs
   WHERE batch_id = @batchId AND is_deleted = 0
   ```
2. Paginated data: `SELECT *, COUNT(*) OVER() as _totalCount` with optional `event_status` filter and `OFFSET/FETCH`

**Indexes Used**:
- `ix_event_logs_batch_id`

**Complexity**: O(log n) seek + O(batch size) for aggregates + O(page_size) fetch

**Design Notes**:
- Stats count **distinct correlations**, not events (a failed process with 3 events counts as 1 failure)
- Uses `COUNT(DISTINCT CASE WHEN ... THEN correlation_id END)` pattern
- Stats query runs unfiltered (all statuses) while data query respects optional `event_status` filter

---

#### GET /v1/events/batch/{batchId}/summary

**Purpose**: Aggregate statistics for batch monitoring dashboards.

**Database Operations**:
```sql
SELECT
  COUNT(DISTINCT correlation_id) as total_processes,
  COUNT(DISTINCT CASE 
    WHEN event_type = 'PROCESS_END' AND event_status = 'SUCCESS' 
    THEN correlation_id 
  END) as completed,
  COUNT(DISTINCT CASE 
    WHEN event_status = 'FAILURE' 
    THEN correlation_id 
  END) as failed,
  MIN(event_timestamp) as started_at,
  MAX(event_timestamp) as last_event_at
FROM event_logs
WHERE batch_id = @batchId AND is_deleted = 0;
```

**Indexes Used**:
- `ix_event_logs_batch_id`

**Complexity**: O(log n) seek + O(batch size) scan for aggregates

**Design Notes**:
- `in_progress` calculated as: `total_processes - completed - failed`
- Single query computes all stats (no N+1)

---

### Correlation Links

#### POST /v1/correlation-links

**Purpose**: Map a correlation_id to account_id once account is created.

**Database Operations**:
- MSSQL `MERGE` statement (upsert):
  ```sql
  MERGE correlation_links AS target
  USING (SELECT @correlationId AS correlation_id) AS source
  ON target.correlation_id = source.correlation_id
  WHEN MATCHED THEN UPDATE SET account_id = @accountId, ...
  WHEN NOT MATCHED THEN INSERT (...) VALUES (...);
  ```

**Indexes Used**:
- `correlation_links` primary key

**Complexity**: O(log n)

**Design Notes**:
- Enables linking pre-account origination events to account after creation
- Upsert pattern handles retry scenarios gracefully

---

#### GET /v1/correlation-links/{correlationId}

**Purpose**: Retrieve correlation link details.

**Database Operations**:
- `SELECT` by primary key

**Complexity**: O(1)

---

### Process Definitions

#### GET /v1/processes

**Purpose**: List registered process definitions.

**Database Operations**:
- `SELECT` from `process_definitions` (optional `is_active` filter)

**Indexes Used**:
- `ix_process_definitions_owning_team` (if filtered by team)

**Complexity**: O(n) where n = process count (~50-100 rows, negligible)

---

#### POST /v1/processes

**Purpose**: Register new process definition.

**Database Operations**:
- `INSERT` with `OUTPUT` clause

**Indexes Used**:
- `ix_process_definitions_name` (unique constraint check)

**Complexity**: O(log n)

---

## Pagination Strategy

All paginated endpoints use `COUNT(*) OVER()` as a window function to return the total count alongside each data row in a **single query**, eliminating one DB round-trip per request compared to the traditional 2-query pattern (`SELECT COUNT(*)` + `SELECT ... OFFSET/FETCH`).

**Exception**: `POST /v1/events/search/text` uses 2 queries because `CONTAINS()` with `COUNT(*) OVER()` can produce inconsistent counts in MSSQL full-text scenarios.

### Edge Case Handling

When a page is requested beyond the result set (e.g., page 100 when only 50 rows exist), the `COUNT(*) OVER()` window function returns no rows. In this case, a fallback `SELECT COUNT(*)` is issued to return an accurate `total_count` so the client knows the true size. If offset is 0 and no rows are returned, the total is definitively 0 with no fallback needed.

### Pagination Defaults

| Endpoint Category | Default page_size | Max page_size | Rationale |
|-------------------|-------------------|---------------|-----------|
| Standard (account, batch, lookup) | 20 | 100 | Matches typical UI grid sizes |
| Correlation / Trace | 200 | 500 | Most processes have 5-20 steps; 200 captures virtually all without needing pagination params |
| Text search | 20 | 50 | Lower cap to bound full-text query cost |

---

## Performance Summary

### Query Complexity by Endpoint

| Endpoint | Complexity | Index Dependency | Queries |
|----------|------------|------------------|---------|
| GET /healthcheck | O(1) | none | 0 |
| GET /healthcheck/ready | O(1) | none | 1 |
| POST /events (single) | O(1) | idempotency (optional) | 1-2 |
| POST /events (array) | O(k + n/chunk) | idempotency | 2+ |
| POST /events/batch | O(k + n/chunk) | idempotency | 2+ |
| GET /events/account/{id} | O(log n + page) | account_id | 1 |
| GET /events/correlation/{id} | O(log n + page) | correlation_id | 1 + 1 link |
| GET /events/trace/{id} | O(log n + page) | trace_id | 3 |
| GET /events/account/{id}/summary | O(1) | account_id | 3 |
| POST /events/lookup | O(log n + page) | account_id, process | 1 |
| POST /events/search/text | O(log n + page) | full-text | 2 |
| POST /events/batch/upload | O(k + n/chunk) | idempotency | 2+ |
| GET /events/batch/{id} | O(log n + batch) | batch_id | 1 + 1 stats |
| GET /events/batch/{id}/summary | O(log n + batch) | batch_id | 1 + 1 corr |
| POST /correlation-links | O(log n) | primary key | 1 |
| GET /correlation-links/{id} | O(1) | primary key | 1 |
| GET /processes | O(n) | none (small table) | 1 |
| POST /processes | O(log n) | process_name | 1 |

### Critical Indexes

If these indexes are missing, performance degrades significantly:

| Index | Impact if Missing |
|-------|-------------------|
| `ix_event_logs_account_id` | Account timeline queries become O(n) table scans |
| `ix_event_logs_correlation_id` | Process queries become O(n) table scans |
| `ix_event_logs_batch_id` | Batch queries scan entire table |
| Full-text index | Text search goes from 50ms to 5 seconds |

### Expected Query Times at Scale

| Operation | 100k rows | 500k rows | 1M rows |
|-----------|-----------|-----------|---------|
| Single event insert | <10ms | <10ms | <10ms |
| Batch insert (100 events) | 50-100ms | 50-100ms | 50-100ms |
| Account timeline (page 1) | 5-20ms | 10-30ms | 15-50ms |
| Correlation lookup | 2-10ms | 5-15ms | 5-20ms |
| Trace lookup | 2-10ms | 5-15ms | 5-20ms |
| Event lookup | 5-20ms | 10-30ms | 15-50ms |
| Full-text search | 10-30ms | 20-50ms | 30-80ms |
| Batch summary | 20-50ms | 50-100ms | 80-150ms |

*Times assume warm cache and proper indexing.*

---

## Appendix: Index Migration Script

See `drizzle-mssql/manual/001_indexes.sql` and `002_fulltext_search.sql` for complete index definitions with filtered index WHERE clauses.
