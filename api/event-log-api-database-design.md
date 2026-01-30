# Event Log API — Database & Endpoint Technical Design

## Version 1.0 | January 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Indexing Strategy](#indexing-strategy)
3. [Endpoint Reference](#endpoint-reference)
   - [Event Ingestion](#event-ingestion)
   - [Event Queries](#event-queries)
   - [Search Operations](#search-operations)
   - [Batch Operations](#batch-operations)
   - [Correlation Links](#correlation-links)
   - [Process Definitions](#process-definitions)
4. [Performance Summary](#performance-summary)

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

### Event Ingestion

#### POST /v1/events

**Purpose**: Create one or more event log entries.

**Database Operations**:
1. If `idempotency_key` provided: `SELECT` to check existence
2. `INSERT` with `OUTPUT` clause to return `execution_id`

**Indexes Used**:
- `ix_event_logs_idempotency` (idempotency check)

**Complexity**: O(1) per event

**Design Notes**:
- Idempotency check before insert prevents duplicates from retry logic
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

**Database Operations**:
1. `SELECT COUNT(*)` for total (with filters)
2. `SELECT ... ORDER BY event_timestamp DESC OFFSET x FETCH y`

**Optional**: If `include_linked=true`, subquery joins `correlation_links` to include pre-account events.

**Indexes Used**:
- `ix_event_logs_account_id` (primary filter)
- `ix_event_logs_process` (if `process_name` filter)
- `ix_event_logs_status` (if `event_status=FAILURE` filter)

**Complexity**: O(log n) index seek + O(page_size) fetch

**Query Pattern**:
```sql
-- Without include_linked
SELECT * FROM event_logs
WHERE account_id = @accountId
  AND is_deleted = 0
  [AND process_name = @processName]
  [AND event_status = @eventStatus]
  [AND event_timestamp >= @startDate]
  [AND event_timestamp <= @endDate]
ORDER BY event_timestamp DESC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

-- With include_linked
SELECT * FROM event_logs
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

**Purpose**: Retrieve all events for a business process instance.

**Database Operations**:
1. `SELECT` from `event_logs` filtered by `correlation_id`
2. `SELECT` from `correlation_links` to check if linked to account

**Indexes Used**:
- `ix_event_logs_correlation_id`
- `correlation_links` primary key

**Complexity**: O(log n) + O(m) where m = events in process (typically 5-20)

**Design Notes**:
- Orders by `step_sequence, event_timestamp` to reconstruct process flow
- Returns `is_linked` flag indicating if correlation has been mapped to account

---

#### GET /v1/events/trace/{traceId}

**Purpose**: Retrieve all events sharing a distributed trace ID.

**Database Operations**:
1. `SELECT` from `event_logs` filtered by `trace_id`
2. Compute `systems_involved` (distinct `target_system` values)
3. Compute `total_duration_ms` (last timestamp - first timestamp)

**Indexes Used**:
- `ix_event_logs_trace_id`

**Complexity**: O(log n) + O(m) where m = events in trace (typically 1-10)

**Design Notes**:
- Trace IDs follow W3C format, propagated via `traceparent` header
- Duration calculated in application layer from ordered results

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

### Search Operations

#### POST /v1/events/search/text

**Purpose**: Full-text search across event summaries.

**Database Operations**:
1. `SELECT COUNT(*)` with `CONTAINS()` predicate
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

**Database Operations**:
1. `SELECT COUNT(*)` for total
2. Aggregate query for stats:
   ```sql
   SELECT
     COUNT(DISTINCT correlation_id) as unique_correlations,
     COUNT(DISTINCT CASE WHEN event_status = 'SUCCESS' THEN correlation_id END) as success_count,
     COUNT(DISTINCT CASE WHEN event_status = 'FAILURE' THEN correlation_id END) as failure_count
   FROM event_logs
   WHERE batch_id = @batchId AND is_deleted = 0
   ```
3. `SELECT` with pagination

**Indexes Used**:
- `ix_event_logs_batch_id`

**Complexity**: O(log n) seek + O(batch size) for aggregates

**Design Notes**:
- Stats count **distinct correlations**, not events (a failed process with 3 events counts as 1 failure)
- Uses `COUNT(DISTINCT CASE WHEN ... THEN correlation_id END)` pattern

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

## Performance Summary

### Query Complexity by Endpoint

| Endpoint | Complexity | Index Dependency |
|----------|------------|------------------|
| POST /events | O(1) | idempotency (optional) |
| POST /events/batch | O(k + n/chunk) | idempotency |
| GET /events/account/{id} | O(log n + page) | account_id |
| GET /events/correlation/{id} | O(log n + m) | correlation_id |
| GET /events/trace/{id} | O(log n + m) | trace_id |
| GET /events/account/{id}/summary | O(1) | account_id |
| POST /events/search/text | O(log n + page) | full-text |
| POST /events/batch/upload | O(k + n/chunk) | idempotency |
| GET /events/batch/{id} | O(log n + batch) | batch_id |
| GET /events/batch/{id}/summary | O(log n + batch) | batch_id |
| POST /correlation-links | O(log n) | primary key |
| GET /correlation-links/{id} | O(1) | primary key |
| GET /processes | O(n) | none (small table) |
| POST /processes | O(log n) | process_name |

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
| Full-text search | 10-30ms | 20-50ms | 30-80ms |
| Batch summary | 20-50ms | 50-100ms | 80-150ms |

*Times assume warm cache and proper indexing.*

---

## Appendix: Index Migration Script

See `drizzle-mssql/manual/001_indexes.sql` and `002_fulltext_search.sql` for complete index definitions with filtered index WHERE clauses.
