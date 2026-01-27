# Event Log Schema v1.4 - Implementation Prompt

## Overview

Update the Event Log API schema from v1.3 to v1.4. This update adds two new fields to support batch operations and OpenTelemetry-compliant parallel span tracking.

## New Fields

### 1. `batch_id` (NVARCHAR(200), nullable)

**Purpose:** Groups multiple independent process instances that were triggered by a single batch operation (e.g., CSV upload of 100 employee applications).

**Key characteristics:**
- Each row in a batch gets its own `correlation_id` and `trace_id`
- `batch_id` ties them together for aggregate queries
- Optional — only populated for batch operations

**Example:**
```
Batch CSV Upload: 100 employees
batch_id: "batch-20250126-hr-upload"

  Employee 1: correlation_id: "corr-001", trace_id: "trace-aaa"
  Employee 2: correlation_id: "corr-002", trace_id: "trace-bbb"
  ...
  Employee 100: correlation_id: "corr-100", trace_id: "trace-zzz"
```

### 2. `span_links` (NVARCHAR(MAX), nullable)

**Purpose:** Captures causal relationships when a span depends on multiple parent spans completing (fork-join pattern). This is the OpenTelemetry standard for representing parallel dependencies.

**Key characteristics:**
- JSON array of span IDs that this span waited for
- Used when parallel steps must complete before the next step begins
- `parent_span_id` still points to the orchestrating span
- `span_links` captures the additional dependencies

**Example:**
```
Step 2a: ODS Entry         (span_id: "span-003") ──┐
                                                    ├── both complete
Step 2b: Regulatory Init   (span_id: "span-004") ──┘
                                                    │
                                                    ▼
Step 3: Background Check   (span_id: "span-005")
        parent_span_id: "span-002"  ← orchestrator
        span_links: ["span-003", "span-004"]  ← waited for these
```

---

## SQL DDL Changes

Add to the `event_logs` table after the `parent_span_id` column:

```sql
-- ============================================================================
-- SCHEMA UPDATE: v1.3 → v1.4
-- ============================================================================

-- Add batch_id column
ALTER TABLE event_logs ADD batch_id NVARCHAR(200) NULL;

-- Add span_links column (JSON array of span IDs for fork-join patterns)
ALTER TABLE event_logs ADD span_links NVARCHAR(MAX) NULL;

-- Index for batch queries
CREATE INDEX IX_event_logs_batch_id 
    ON event_logs (batch_id, correlation_id)
    WHERE batch_id IS NOT NULL;
```

### Full Table DDL (for reference)

The `event_logs` table should now include these columns in order:

```sql
CREATE TABLE event_logs (
    event_log_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    execution_id        UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,

    -- Core identifiers
    correlation_id      NVARCHAR(200) NOT NULL,
    account_id          NVARCHAR(64) NULL,
    trace_id            NVARCHAR(200) NOT NULL,
    span_id             NVARCHAR(64) NULL,
    parent_span_id      NVARCHAR(64) NULL,
    span_links          NVARCHAR(MAX) NULL,  -- NEW IN v1.4: JSON array of awaited span IDs
    batch_id            NVARCHAR(200) NULL,  -- NEW IN v1.4: Groups batch operations

    -- System context
    application_id      NVARCHAR(200) NOT NULL,
    target_system       NVARCHAR(200) NOT NULL,
    originating_system  NVARCHAR(200) NOT NULL,

    -- Process details
    process_name        NVARCHAR(510) NOT NULL,
    step_sequence       INT NULL,
    step_name           NVARCHAR(510) NULL,
    event_type          NVARCHAR(50) NOT NULL,
    event_status        NVARCHAR(50) NOT NULL,

    -- Business data
    identifiers         NVARCHAR(MAX) NOT NULL,
    summary             NVARCHAR(MAX) NOT NULL,
    result              NVARCHAR(2048) NOT NULL,
    metadata            NVARCHAR(MAX) NULL,

    -- Timing
    event_timestamp     DATETIME2 NOT NULL,
    created_at          DATETIME2 DEFAULT GETUTCDATE() NOT NULL,
    execution_time_ms   INT NULL,

    -- HTTP details
    endpoint            NVARCHAR(510) NULL,
    http_status_code    INT NULL,
    http_method         NVARCHAR(20) NULL,

    -- Error tracking
    error_code          NVARCHAR(100) NULL,
    error_message       NVARCHAR(2048) NULL,

    -- Payloads
    request_payload     NVARCHAR(MAX) NULL,
    response_payload    NVARCHAR(MAX) NULL,

    -- Control fields
    idempotency_key     NVARCHAR(128) NULL,
    is_deleted          BIT DEFAULT 0 NOT NULL,

    -- Constraints
    CONSTRAINT CK_event_logs_event_type
        CHECK (event_type IN ('PROCESS_START', 'STEP', 'PROCESS_END', 'ERROR')),
    CONSTRAINT CK_event_logs_event_status
        CHECK (event_status IN ('SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED')),
    CONSTRAINT CK_event_logs_http_method
        CHECK (http_method IS NULL OR http_method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'))
);
```

---

## TypeScript Interface Changes

### Update `EventLogEntry` interface

Add these fields after `parent_span_id`:

```typescript
export interface EventLogEntry {
  // Core identifiers
  correlation_id: string;
  account_id?: string | null;
  trace_id: string;
  span_id?: string;
  parent_span_id?: string;
  
  /**
   * JSON array of span IDs that this span waited for (fork-join pattern).
   * Used when parallel steps must complete before this step can begin.
   * Follows OpenTelemetry span links specification.
   * 
   * @example ["span-003", "span-004"] // Waited for both parallel steps
   */
  span_links?: string[];
  
  /**
   * Groups multiple process instances from a single batch operation.
   * Each row in a batch still gets its own correlation_id and trace_id.
   * 
   * @example "batch-20250126-hr-upload"
   */
  batch_id?: string;

  // ... rest of existing fields
}
```

### Update `BaseEvent` interface (discriminated union base)

```typescript
interface BaseEvent {
  correlation_id: string;
  account_id?: string | null;
  trace_id: string;
  span_id?: string;
  parent_span_id?: string;
  span_links?: string[];  // NEW IN v1.4
  batch_id?: string;      // NEW IN v1.4
  application_id: string;
  target_system: string;
  originating_system: string;
  process_name: string;
  identifiers: EventIdentifiers;
  summary: string;
  result: string;
  metadata?: Record<string, unknown>;
  event_timestamp: string;
  idempotency_key?: string;
}
```

### Update `EventLogRecord` interface

The record interface extends `EventLogEntry`, so it inherits the new fields automatically. No changes needed.

---

## New API Types

Add batch-specific request/response types:

```typescript
// POST /api/v1/events/batch/upload
export interface BatchUploadRequest {
  batch_id: string;
  events: EventLogEntry[];
}

export interface BatchUploadResponse {
  success: boolean;
  batch_id: string;
  total_received: number;
  total_inserted: number;
  correlation_ids: string[];
  errors?: Array<{
    index: number;
    correlation_id?: string;
    error: string;
  }>;
}

// GET /api/v1/events/batch/{batch_id}
export interface GetEventsByBatchRequest {
  batch_id: string;
  event_status?: EventStatus;
  page?: number;
  page_size?: number;
}

export interface GetEventsByBatchResponse {
  batch_id: string;
  events: EventLogRecord[];
  total_count: number;
  unique_correlation_ids: number;
  success_count: number;
  failure_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// GET /api/v1/events/batch/{batch_id}/summary
export interface BatchSummaryResponse {
  batch_id: string;
  total_processes: number;
  completed: number;
  in_progress: number;
  failed: number;
  correlation_ids: string[];
  started_at: string;
  last_event_at: string;
}
```

---

## New Query Patterns

### Get all events for a batch

```sql
SELECT 
    correlation_id,
    process_name,
    event_type,
    event_status,
    summary,
    event_timestamp
FROM event_logs 
WHERE batch_id = @batch_id
ORDER BY correlation_id, step_sequence;
```

### Get batch summary statistics

```sql
SELECT 
    batch_id,
    COUNT(DISTINCT correlation_id) as total_processes,
    COUNT(*) as total_events,
    SUM(CASE WHEN event_type = 'PROCESS_END' AND event_status = 'SUCCESS' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN event_type = 'PROCESS_END' AND event_status = 'FAILURE' THEN 1 ELSE 0 END) as failed,
    MIN(event_timestamp) as started_at,
    MAX(event_timestamp) as last_event_at
FROM event_logs
WHERE batch_id = @batch_id
GROUP BY batch_id;
```

### Find events with span dependencies (fork-join)

```sql
SELECT 
    span_id,
    parent_span_id,
    span_links,
    step_name,
    summary
FROM event_logs
WHERE correlation_id = @correlation_id
  AND span_links IS NOT NULL
ORDER BY step_sequence;
```

### Reconstruct parallel execution timeline

```sql
WITH SpanTimeline AS (
    SELECT 
        span_id,
        parent_span_id,
        JSON_QUERY(span_links) as span_links,
        step_name,
        step_sequence,
        event_timestamp,
        execution_time_ms
    FROM event_logs
    WHERE trace_id = @trace_id
)
SELECT * FROM SpanTimeline
ORDER BY event_timestamp;
```

---

## REST API Endpoints to Add

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events/batch/upload` | Upload batch of events with shared batch_id |
| GET | `/api/v1/events/batch/{batch_id}` | Get all events for a batch |
| GET | `/api/v1/events/batch/{batch_id}/summary` | Get batch statistics |

---

## Validation Rules

### batch_id
- Max length: 200 characters
- Format recommendation: `batch-{YYYYMMDD}-{source}-{random}` (e.g., `batch-20250126-hr-upload-a1b2c3`)
- Must be consistent across all events in the same batch

### span_links
- Must be valid JSON array of strings
- Each string should be a valid span_id format
- Should only reference span_ids within the same trace_id
- Empty array `[]` is valid but prefer `NULL` when no links exist

**Validation constraint (optional):**
```sql
CONSTRAINT CK_event_logs_span_links_json
    CHECK (span_links IS NULL OR ISJSON(span_links) = 1)
```

---

## Migration Checklist

1. [ ] Add `batch_id` column to `event_logs` table
2. [ ] Add `span_links` column to `event_logs` table
3. [ ] Create index `IX_event_logs_batch_id`
4. [ ] Update TypeScript interfaces (`EventLogEntry`, `BaseEvent`)
5. [ ] Add new batch-related API types
6. [ ] Update API endpoints to accept new fields
7. [ ] Add batch query endpoints
8. [ ] Update documentation/changelog to v1.4
9. [ ] Add validation for `span_links` JSON format

---

## Changelog

### v1.4 Changes from v1.3

| Change | Description |
|--------|-------------|
| Added `batch_id` | Groups multiple process instances from single batch operation |
| Added `span_links` | JSON array of span IDs for fork-join parallel dependencies (OpenTelemetry compliant) |
| Added batch endpoints | New REST endpoints for batch queries and summaries |
| Added `IX_event_logs_batch_id` index | Filtered index for batch queries |

---

## OpenTelemetry Alignment Notes

This schema follows OpenTelemetry conventions:

| OTel Concept | Schema Field | Notes |
|--------------|--------------|-------|
| Trace ID | `trace_id` | One per user action/request boundary |
| Span ID | `span_id` | One per operation within a trace |
| Parent Span ID | `parent_span_id` | Direct causal parent |
| Span Links | `span_links` | Non-parent causal relationships (fork-join) |

The `batch_id` field is outside OTel scope — it's a business-level grouping for bulk operations.
