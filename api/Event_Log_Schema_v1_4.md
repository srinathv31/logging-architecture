# Event Log API - Complete Schema & Interfaces
## Technical schema reference for API v1

Release history is maintained in `CHANGELOG.md`.

---

## Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT LOG SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐       ┌─────────────────┐       ┌──────────────────┐  │
│  │  event_logs     │       │correlation_links│       │ event_embeddings │  │
│  │  (primary)      │──────▶│  (identity      │       │ (vector search)  │  │
│  │                 │       │   resolution)   │       │                  │  │
│  └────────┬────────┘       └─────────────────┘       └──────────────────┘  │
│           │                                                                 │
│           │                                                                 │
│  ┌────────▼────────┐       ┌─────────────────┐                             │
│  │ account_        │       │ process_        │                             │
│  │ timeline_summary│       │ definitions     │                             │
│  │ (aggregation)   │       │ (registry)      │                             │
│  └─────────────────┘       └─────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Changelog from v1.4

- **Added `POST /v1/events/lookup` endpoint** — Fast structured event lookup by account/process with optional date and status filters. Designed for dashboard and agent workflows.

- **Added pagination to correlation and trace endpoints** — `GET /v1/events/correlation/{id}` and `GET /v1/events/trace/{id}` now accept `page` and `page_size` query params (default page_size=200, max 500). Responses include `total_count`, `page`, `page_size`, `has_more`.

- **Single-query pagination with `COUNT(*) OVER()`** — Paginated endpoints now use a window function to return total count alongside data rows, eliminating one DB round-trip per request.

- **Search guardrails on `POST /v1/events/search/text`** — Requires at least one of `account_id` or `process_name`. Date window capped at 30 days. Page size capped at 50.

- **POST /v1/events array mode routes through batch service** — Sending an array to `POST /v1/events` now uses the transactional batch insert path with per-item error reporting and all unique `correlation_ids` in the response.

- **Moved health endpoints under `/v1`** — `GET /v1/healthcheck`, `GET /v1/healthcheck/ready`, and new `GET /v1/version`. Liveness and version responses are pre-computed at startup.

- **Bumped OpenAPI version to 1.5.0** and added `Lookup` tag.

## Changelog from v1.3 → v1.4

- **Added `batch_id` field** (NVARCHAR(200), optional) - Groups multiple independent process instances triggered by a single batch operation (e.g., CSV upload). Each row in a batch gets its own `correlation_id` and `trace_id`, but shares a `batch_id`.

- **Added `span_links` field** (NVARCHAR(MAX), optional) - JSON array of span IDs that this span waited for (fork-join pattern). Follows OpenTelemetry span links specification for capturing parallel dependencies.

- **Added batch-related API endpoints** - New endpoints for querying and summarizing batch operations.

- **Added `IX_event_logs_batch_id` index** - Filtered index for efficient batch queries.

---

## OpenTelemetry Identifier Hierarchy

This schema follows W3C Trace Context and OpenTelemetry conventions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IDENTIFIER HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  batch_id (optional)                                                        │
│  └── Groups multiple process instances from one batch operation             │
│      Example: CSV upload of 100 employee applications                       │
│                                                                             │
│      correlation_id (1 per process instance)                                │
│      └── Ties together all events for one business process                  │
│          Example: One employee's complete application journey               │
│                                                                             │
│          trace_id (1 per request/action boundary)                           │
│          └── One user action = one trace_id                                 │
│              Propagates across service boundaries via headers               │
│                                                                             │
│              span_id / parent_span_id (1 per operation)                     │
│              └── Operations within a trace                                  │
│                  parent_span_id creates the call hierarchy                  │
│                                                                             │
│                  span_links (for fork-join)                                 │
│                  └── References spans this operation waited for             │
│                      Used when multiple parallel spans must complete        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use Each Identifier

| Identifier | Scope | Generated When | Example |
|------------|-------|----------------|---------|
| `batch_id` | Multiple processes | Batch operation starts | `batch-20250126-hr-upload` |
| `correlation_id` | Single process instance | Process begins | `corr-emp-20250126-a1b2c3` |
| `trace_id` | Single request journey | HTTP request enters system | `4bf92f3577b34da6a3ce929d0e0e4736` |
| `span_id` | Single operation | Each step/call within request | `a1b2c3d4e5f60001` |
| `parent_span_id` | Call hierarchy | Child operation starts | Points to triggering span |
| `span_links` | Fork-join dependencies | After parallel steps complete | `["span-003", "span-004"]` |

---

## Table 1: event_logs

Primary event storage table.

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `event_log_id` | BIGINT | Auto | IDENTITY | Primary key |
| `execution_id` | UUID | Auto | NEWID() | Unique execution identifier |
| `correlation_id` | NVARCHAR(200) | **Yes** | — | Process-level anchor ID (ties events across identity boundary) |
| `account_id` | NVARCHAR(64) | No | NULL | Account identifier (NULL until known, e.g., during origination) |
| `trace_id` | NVARCHAR(200) | **Yes** | — | W3C distributed trace ID (request-scoped) |
| `span_id` | NVARCHAR(64) | No | NULL | Span ID within trace |
| `parent_span_id` | NVARCHAR(64) | No | NULL | Parent span for hierarchy |
| `span_links` | NVARCHAR(MAX) | No | NULL | **v1.4:** JSON array of span IDs this span waited for (fork-join) |
| `batch_id` | NVARCHAR(200) | No | NULL | **v1.4:** Groups events from a single batch operation |
| `application_id` | NVARCHAR(200) | **Yes** | — | Source application identifier |
| `target_system` | NVARCHAR(200) | **Yes** | — | Target system being called |
| `originating_system` | NVARCHAR(200) | **Yes** | — | System that initiated the process |
| `process_name` | NVARCHAR(510) | **Yes** | — | Business process name (e.g., `ADD_AUTH_USER`) |
| `step_sequence` | INT | No | NULL | Step order within process (0, 1, 2...) |
| `step_name` | NVARCHAR(510) | No | NULL | Human-readable step description |
| `event_type` | NVARCHAR(50) | **Yes** | — | `PROCESS_START`, `STEP`, `PROCESS_END`, `ERROR` |
| `event_status` | NVARCHAR(50) | **Yes** | — | `SUCCESS`, `FAILURE`, `IN_PROGRESS`, `SKIPPED` |
| `identifiers` | NVARCHAR(MAX) | **Yes** | — | JSON object with all available business IDs |
| `summary` | NVARCHAR(MAX) | **Yes** | — | Human/AI readable narrative of what happened |
| `result` | NVARCHAR(2048) | **Yes** | — | Outcome/result summary (structured) |
| `metadata` | NVARCHAR(MAX) | No | NULL | Additional context as JSON |
| `event_timestamp` | DATETIME2 | **Yes** | — | When the event occurred (app-provided) |
| `created_at` | DATETIME2 | Auto | GETUTCDATE() | DB insertion timestamp |
| `endpoint` | NVARCHAR(510) | No | NULL | API endpoint called |
| `http_status_code` | INT | No | NULL | HTTP response status code |
| `http_method` | NVARCHAR(20) | No | NULL | HTTP method used |
| `execution_time_ms` | INT | No | NULL | Duration in milliseconds |
| `error_code` | NVARCHAR(100) | No | NULL | Standardized error code |
| `error_message` | NVARCHAR(2048) | No | NULL | Error details |
| `idempotency_key` | NVARCHAR(128) | No | NULL | For duplicate detection |
| `request_payload` | NVARCHAR(MAX) | No | NULL | Sanitized request (no PII) |
| `response_payload` | NVARCHAR(MAX) | No | NULL | Sanitized response (no PII) |
| `is_deleted` | BIT | Auto | 0 | Soft delete flag |

### Summary Field Guidelines

The `summary` field should be a **complete, standalone narrative** that an AI or human can understand without needing to parse other fields.

**Good examples:**
- `"Initiated credit card application for customer (SSN ***1234) via web portal"`
- `"Validated authorized user Jane Doe (SSN ***5678) against Experian - identity confirmed, fraud score 0.12"`
- `"Account AC-1234567890 provisioned with processor - $5,000 credit limit approved, card ending 9876 issued"`
- `"Payment of $150.00 posted to account AC-1234567890 - new balance $1,234.56"`
- `"Add Authorized User failed - Experian returned fraud alert code FA-201, user flagged for manual review"`

**Bad examples:**
- `"Step completed"` (too vague)
- `"Success"` (no context)
- `"Called Experian"` (missing outcome)

### span_links Field Guidelines

The `span_links` field captures **fork-join dependencies** — when a span must wait for multiple parallel spans to complete before it can begin.

**When to use:**
- After parallel steps (same `step_sequence`) complete and the next sequential step begins
- The dependent span's `parent_span_id` points to the orchestrator
- `span_links` lists the parallel spans it waited for

**Example:**
```json
["a1b2c3d4e5f60003", "a1b2c3d4e5f60004"]
```

**When NOT to use:**
- Linear/sequential steps (just use `parent_span_id`)
- The first step after process start (no dependencies yet)

### batch_id Field Guidelines

The `batch_id` field groups **multiple independent process instances** from a single batch operation.

**When to use:**
- CSV uploads processed as multiple applications
- Bulk API calls that trigger multiple processes
- Scheduled batch jobs processing multiple records

**Format recommendation:** `batch-{YYYYMMDD}-{source}-{random}`
- Example: `batch-20250126-hr-upload-a1b2c3`

---

## Table 2: correlation_links

Links correlation IDs to account identifiers once known.

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `correlation_id` | NVARCHAR(200) | **PK** | — | Process-level anchor ID |
| `account_id` | NVARCHAR(64) | **Yes** | — | Account identifier |
| `application_id` | NVARCHAR(100) | No | NULL | Origination application ID |
| `customer_id` | NVARCHAR(100) | No | NULL | Customer identifier |
| `card_number_last4` | NVARCHAR(4) | No | NULL | Last 4 of card for reference |
| `linked_at` | DATETIME2 | Auto | GETUTCDATE() | When link was established |

---

## Table 3: event_embeddings

Vector embeddings for AI-powered semantic search.

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `embedding_id` | BIGINT | Auto | IDENTITY | Primary key |
| `event_log_id` | BIGINT | **Yes** | — | FK to event_logs |
| `correlation_id` | NVARCHAR(200) | **Yes** | — | Denormalized for filtering |
| `account_id` | NVARCHAR(64) | No | NULL | Denormalized (NULL if not yet known) |
| `embedding_vector` | VARBINARY(MAX) | **Yes** | — | Embedding vector |
| `embedding_text` | NVARCHAR(MAX) | **Yes** | — | Source text that was embedded (typically the `summary` field) |
| `embedding_model` | NVARCHAR(100) | **Yes** | — | Model used |
| `created_at` | DATETIME2 | Auto | GETUTCDATE() | When generated |

---

## Table 4: process_definitions

Registry of all business processes.

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `process_id` | INT | Auto | IDENTITY | Primary key |
| `process_name` | NVARCHAR(510) | **Yes** | — | Unique process identifier |
| `display_name` | NVARCHAR(510) | **Yes** | — | Human-readable name |
| `description` | NVARCHAR(MAX) | **Yes** | — | Full description for AI context |
| `owning_team` | NVARCHAR(200) | **Yes** | — | Responsible team |
| `expected_steps` | INT | No | NULL | Expected step count |
| `sla_ms` | INT | No | NULL | Expected duration in ms |
| `is_active` | BIT | Auto | 1 | Whether currently in use |
| `created_at` | DATETIME2 | Auto | GETUTCDATE() | Registration timestamp |
| `updated_at` | DATETIME2 | Auto | GETUTCDATE() | Last modification |

---

## Table 5: account_timeline_summary

Pre-aggregated account summary for fast lookups.

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `account_id` | NVARCHAR(64) | **PK** | — | Account identifier |
| `first_event_at` | DATETIME2 | **Yes** | — | Earliest event |
| `last_event_at` | DATETIME2 | **Yes** | — | Most recent event |
| `total_events` | INT | **Yes** | — | Event count |
| `total_processes` | INT | **Yes** | — | Distinct process count |
| `error_count` | INT | **Yes** | 0 | Failure count |
| `last_process` | NVARCHAR(510) | No | NULL | Most recent process |
| `systems_touched` | NVARCHAR(MAX) | No | NULL | JSON array of systems |
| `correlation_ids` | NVARCHAR(MAX) | No | NULL | JSON array of all correlation IDs |
| `updated_at` | DATETIME2 | Auto | GETUTCDATE() | Last refresh |

---

## SQL DDL

```sql
-- ============================================================================
-- EVENT LOG API - DATABASE SCHEMA
-- Version 1.5
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: event_logs
-- ----------------------------------------------------------------------------
CREATE TABLE event_logs (
    event_log_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    execution_id        UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL,

    -- Core identifiers
    correlation_id      NVARCHAR(200) NOT NULL,
    account_id          NVARCHAR(64) NULL,
    trace_id            NVARCHAR(200) NOT NULL,
    span_id             NVARCHAR(64) NULL,
    parent_span_id      NVARCHAR(64) NULL,
    span_links          NVARCHAR(MAX) NULL,      -- v1.4: JSON array of awaited span IDs
    batch_id            NVARCHAR(200) NULL,      -- v1.4: Groups batch operations

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
        CHECK (http_method IS NULL OR http_method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')),
    CONSTRAINT CK_event_logs_span_links_json
        CHECK (span_links IS NULL OR ISJSON(span_links) = 1)
);

-- Indexes for event_logs
CREATE INDEX IX_event_logs_correlation_id
    ON event_logs (correlation_id, event_timestamp);

CREATE INDEX IX_event_logs_account_id
    ON event_logs (account_id, event_timestamp DESC)
    WHERE account_id IS NOT NULL;

CREATE INDEX IX_event_logs_trace_id
    ON event_logs (trace_id);

CREATE INDEX IX_event_logs_process
    ON event_logs (process_name, event_timestamp);

CREATE INDEX IX_event_logs_timestamp
    ON event_logs (event_timestamp);

CREATE INDEX IX_event_logs_status
    ON event_logs (event_status, event_timestamp)
    WHERE event_status = 'FAILURE';

CREATE INDEX IX_event_logs_target_system
    ON event_logs (target_system, event_timestamp);

CREATE UNIQUE INDEX IX_event_logs_idempotency
    ON event_logs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- v1.4: Index for batch queries
CREATE INDEX IX_event_logs_batch_id
    ON event_logs (batch_id, correlation_id)
    WHERE batch_id IS NOT NULL;

-- Full-text index on summary for AI text search (SQL Server)
CREATE UNIQUE INDEX IX_event_logs_fulltext_key ON event_logs (event_log_id);
CREATE FULLTEXT CATALOG EventLogCatalog AS DEFAULT;
CREATE FULLTEXT INDEX ON event_logs (summary) KEY INDEX IX_event_logs_fulltext_key ON EventLogCatalog;


-- ----------------------------------------------------------------------------
-- Table: correlation_links
-- ----------------------------------------------------------------------------
CREATE TABLE correlation_links (
    correlation_id      NVARCHAR(200) PRIMARY KEY,
    account_id          NVARCHAR(64) NOT NULL,
    application_id      NVARCHAR(100) NULL,
    customer_id         NVARCHAR(100) NULL,
    card_number_last4   NVARCHAR(4) NULL,
    linked_at           DATETIME2 DEFAULT GETUTCDATE() NOT NULL
);

-- Indexes for correlation_links
CREATE INDEX IX_correlation_links_account_id
    ON correlation_links (account_id);

CREATE INDEX IX_correlation_links_application_id
    ON correlation_links (application_id)
    WHERE application_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Table: event_embeddings
-- ----------------------------------------------------------------------------
CREATE TABLE event_embeddings (
    embedding_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    event_log_id        BIGINT NOT NULL,
    correlation_id      NVARCHAR(200) NOT NULL,
    account_id          NVARCHAR(64) NULL,
    embedding_vector    VARBINARY(MAX) NOT NULL,
    embedding_text      NVARCHAR(MAX) NOT NULL,
    embedding_model     NVARCHAR(100) NOT NULL,
    created_at          DATETIME2 DEFAULT GETUTCDATE() NOT NULL,

    CONSTRAINT FK_event_embeddings_event_log
        FOREIGN KEY (event_log_id) REFERENCES event_logs(event_log_id)
);

-- Indexes for event_embeddings
CREATE INDEX IX_event_embeddings_event_log_id
    ON event_embeddings (event_log_id);

CREATE INDEX IX_event_embeddings_correlation_id
    ON event_embeddings (correlation_id);

CREATE INDEX IX_event_embeddings_account_id
    ON event_embeddings (account_id)
    WHERE account_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Table: process_definitions
-- ----------------------------------------------------------------------------
CREATE TABLE process_definitions (
    process_id          INT IDENTITY(1,1) PRIMARY KEY,
    process_name        NVARCHAR(510) NOT NULL UNIQUE,
    display_name        NVARCHAR(510) NOT NULL,
    description         NVARCHAR(MAX) NOT NULL,
    owning_team         NVARCHAR(200) NOT NULL,
    expected_steps      INT NULL,
    sla_ms              INT NULL,
    is_active           BIT DEFAULT 1 NOT NULL,
    created_at          DATETIME2 DEFAULT GETUTCDATE() NOT NULL,
    updated_at          DATETIME2 DEFAULT GETUTCDATE() NOT NULL
);

-- Indexes for process_definitions
CREATE INDEX IX_process_definitions_owning_team
    ON process_definitions (owning_team);


-- ----------------------------------------------------------------------------
-- Table: account_timeline_summary
-- ----------------------------------------------------------------------------
CREATE TABLE account_timeline_summary (
    account_id          NVARCHAR(64) PRIMARY KEY,
    first_event_at      DATETIME2 NOT NULL,
    last_event_at       DATETIME2 NOT NULL,
    total_events        INT NOT NULL,
    total_processes     INT NOT NULL,
    error_count         INT NOT NULL DEFAULT 0,
    last_process        NVARCHAR(510) NULL,
    systems_touched     NVARCHAR(MAX) NULL,
    correlation_ids     NVARCHAR(MAX) NULL,
    updated_at          DATETIME2 DEFAULT GETUTCDATE() NOT NULL
);

-- Index for account_timeline_summary
CREATE INDEX IX_account_timeline_summary_last_event
    ON account_timeline_summary (last_event_at DESC);
```

---

## TypeScript Interfaces

```typescript
// ============================================================================
// EVENT LOG API - TYPESCRIPT INTERFACES
// Version 1.5
// ============================================================================

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------

export const EventType = {
  PROCESS_START: 'PROCESS_START',
  STEP: 'STEP',
  PROCESS_END: 'PROCESS_END',
  ERROR: 'ERROR',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EventStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIPPED: 'SKIPPED',
} as const;

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

// ----------------------------------------------------------------------------
// Identifiers (flexible bag of business IDs)
// ----------------------------------------------------------------------------

export interface EventIdentifiers {
  // Origination phase
  session_id?: string;
  application_id?: string;
  decision_id?: string;

  // Account/Card identifiers
  card_id?: string;
  card_number_last4?: string;

  // Customer identifiers (always masked/hashed)
  customer_id?: string;
  ssn_last4?: string;

  // Auth user specific
  auth_user_id?: string;
  auth_user_ssn_last4?: string;
  primary_cardholder_id?: string;

  // Servicing
  dispute_id?: string;
  payment_id?: string;
  transaction_id?: string;
  case_id?: string;

  // External vendor references
  vendor_reference_id?: string;
  experian_transaction_id?: string;
  processor_reference_id?: string;

  // Employee-specific (for employee card origination)
  employee_id?: string;
  workday_ref?: string;
  ods_record_id?: string;
  compliance_case_id?: string;
  adm_decision_id?: string;

  // Allow additional custom identifiers
  [key: string]: string | undefined;
}

// ----------------------------------------------------------------------------
// Event Log Entry (for API requests)
// ----------------------------------------------------------------------------

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

  // System context
  application_id: string;
  target_system: string;
  originating_system: string;

  // Process details
  process_name: string;
  step_sequence?: number;
  step_name?: string;
  event_type: EventType;
  event_status: EventStatus;

  // Business data
  identifiers: EventIdentifiers;

  /**
   * Human and AI readable narrative describing what happened.
   * Should be a complete, standalone description that can be understood
   * without parsing other fields.
   *
   * @example "Validated authorized user Jane Doe (SSN ***5678) against Experian - identity confirmed"
   * @example "Payment of $150.00 posted to account AC-1234567890 - new balance $1,234.56"
   */
  summary: string;

  /**
   * Structured outcome/result (for programmatic use).
   * Use `summary` for AI/human readable narratives.
   */
  result: string;

  metadata?: Record<string, unknown>;

  // Timing
  event_timestamp: string; // ISO 8601
  execution_time_ms?: number;

  // HTTP details (for API calls)
  endpoint?: string;
  http_method?: HttpMethod;
  http_status_code?: number;

  // Error tracking
  error_code?: string;
  error_message?: string;

  // Payloads (sanitized - no PII)
  request_payload?: string;
  response_payload?: string;

  // Deduplication
  idempotency_key?: string;
}

// ----------------------------------------------------------------------------
// Event Log Record (returned from DB)
// ----------------------------------------------------------------------------

export interface EventLogRecord extends EventLogEntry {
  event_log_id: number;
  execution_id: string;
  created_at: string;
  is_deleted: boolean;
}

// ----------------------------------------------------------------------------
// Correlation Link
// ----------------------------------------------------------------------------

export interface CorrelationLink {
  correlation_id: string;
  account_id: string;
  application_id?: string;
  customer_id?: string;
  card_number_last4?: string;
  linked_at: string;
}

// ----------------------------------------------------------------------------
// Process Definition
// ----------------------------------------------------------------------------

export interface ProcessDefinition {
  process_id?: number;
  process_name: string;
  display_name: string;
  description: string;
  owning_team: string;
  expected_steps?: number;
  sla_ms?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------------------------------
// Account Timeline Summary
// ----------------------------------------------------------------------------

export interface AccountTimelineSummary {
  account_id: string;
  first_event_at: string;
  last_event_at: string;
  total_events: number;
  total_processes: number;
  error_count: number;
  last_process?: string;
  systems_touched?: string[];
  correlation_ids?: string[];
  updated_at: string;
}

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

// POST /v1/events (single event)
export interface CreateEventRequest {
  events: EventLogEntry | EventLogEntry[];
}

export interface CreateEventResponse {
  success: boolean;
  execution_ids: string[];
  correlation_id: string;
}

// POST /v1/events (array of events — routes through batch service)
export interface CreateEventArrayResponse {
  success: boolean;
  total_received: number;
  total_inserted: number;
  execution_ids: string[];
  correlation_ids: string[];
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

// POST /v1/events/batch
export interface BatchCreateEventRequest {
  events: EventLogEntry[];
}

export interface BatchCreateEventResponse {
  success: boolean;
  total_received: number;
  total_inserted: number;
  execution_ids: string[];
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

// POST /v1/events/batch/upload
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
    error: string;
  }>;
}

// GET /v1/events/batch/{batch_id}
export interface GetEventsByBatchRequest {
  batch_id: string;
  event_status?: EventStatus;
  page?: number;      // default 1
  page_size?: number;  // default 20, max 100
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

// GET /v1/events/batch/{batch_id}/summary
export interface BatchSummaryResponse {
  batch_id: string;
  total_processes: number;
  completed: number;
  in_progress: number;
  failed: number;
  correlation_ids: string[];
  started_at: string | null;
  last_event_at: string | null;
}

// GET /v1/events/account/{account_id}
export interface GetEventsByAccountRequest {
  account_id: string;
  start_date?: string;
  end_date?: string;
  process_name?: string;
  event_status?: EventStatus;
  include_linked?: boolean;
  page?: number;      // default 1
  page_size?: number;  // default 20, max 100
}

export interface GetEventsByAccountResponse {
  account_id: string;
  events: EventLogRecord[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// GET /v1/events/correlation/{correlation_id}
export interface GetEventsByCorrelationRequest {
  correlation_id: string;
  page?: number;      // default 1
  page_size?: number;  // default 200, max 500
}

export interface GetEventsByCorrelationResponse {
  correlation_id: string;
  account_id: string | null;
  events: EventLogRecord[];
  is_linked: boolean;
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// GET /v1/events/trace/{trace_id}
export interface GetEventsByTraceRequest {
  trace_id: string;
  page?: number;      // default 1
  page_size?: number;  // default 200, max 500
}

export interface GetEventsByTraceResponse {
  trace_id: string;
  events: EventLogRecord[];
  systems_involved: string[];
  total_duration_ms: number | null;
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// POST /v1/events/search/text
// Guardrails: at least one of account_id or process_name required.
// Date window capped at 30 days. Page size max 50.
export interface TextSearchRequest {
  query: string;
  account_id?: string;    // required if process_name is not provided
  process_name?: string;  // required if account_id is not provided
  start_date?: string;    // must pair with end_date; window ≤ 30 days
  end_date?: string;
  page?: number;      // default 1
  page_size?: number;  // default 20, max 50
}

export interface TextSearchResponse {
  query: string;
  events: EventLogRecord[];
  total_count: number;
  page: number;
  page_size: number;
}

// POST /v1/events/lookup
// Guardrails: at least one of account_id or process_name required.
// Date window capped at 30 days.
export interface LookupEventsRequest {
  account_id?: string;    // required if process_name is not provided
  process_name?: string;  // required if account_id is not provided
  event_status?: EventStatus;
  start_date?: string;    // must pair with end_date; window ≤ 30 days
  end_date?: string;
  page?: number;      // default 1
  page_size?: number;  // default 20, max 100
}

export interface LookupEventsResponse {
  events: EventLogRecord[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// POST /v1/correlation-links
export interface CreateCorrelationLinkRequest {
  correlation_id: string;
  account_id: string;
  application_id?: string;
  customer_id?: string;
  card_number_last4?: string;
}

export interface CreateCorrelationLinkResponse {
  success: boolean;
  correlation_id: string;
  account_id: string;
  linked_at: string;
}

// GET /v1/events/account/{account_id}/summary
export interface GetAccountSummaryResponse {
  summary: AccountTimelineSummary;
  recent_events: EventLogRecord[];
  recent_errors: EventLogRecord[];
}

// ----------------------------------------------------------------------------
// Discriminated Union for Event Types (Type-Safe Event Creation)
// ----------------------------------------------------------------------------

interface BaseEvent {
  correlation_id: string;
  account_id?: string | null;
  trace_id: string;
  span_id?: string;
  parent_span_id?: string;
  span_links?: string[];  // v1.4
  batch_id?: string;      // v1.4
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

export interface ProcessStartEvent extends BaseEvent {
  event_type: typeof EventType.PROCESS_START;
  event_status: typeof EventStatus.IN_PROGRESS;
  step_sequence: 0;
  step_name?: never;
  execution_time_ms?: never;
}

export interface StepEvent extends BaseEvent {
  event_type: typeof EventType.STEP;
  event_status: EventStatus;
  step_sequence: number;
  step_name: string;
  execution_time_ms?: number;
  endpoint?: string;
  http_method?: HttpMethod;
  http_status_code?: number;
  request_payload?: string;
  response_payload?: string;
}

export interface ProcessEndEvent extends BaseEvent {
  event_type: typeof EventType.PROCESS_END;
  event_status: typeof EventStatus.SUCCESS | typeof EventStatus.FAILURE;
  step_sequence: number;
  step_name?: string;
  execution_time_ms: number;
}

export interface ErrorEvent extends BaseEvent {
  event_type: typeof EventType.ERROR;
  event_status: typeof EventStatus.FAILURE;
  step_sequence?: number;
  step_name?: string;
  error_code: string;
  error_message: string;
}

export type TypedEventLogEntry =
  | ProcessStartEvent
  | StepEvent
  | ProcessEndEvent
  | ErrorEvent;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

export function createCorrelationId(prefix: string = 'corr'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

export function createBatchId(source: string = 'batch'): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8);
  return `batch-${date}-${source}-${random}`;
}

export function createProcessStartEvent(
  params: Omit<ProcessStartEvent, 'event_type' | 'event_status' | 'step_sequence'>
): ProcessStartEvent {
  return {
    ...params,
    event_type: EventType.PROCESS_START,
    event_status: EventStatus.IN_PROGRESS,
    step_sequence: 0,
  };
}

export function createStepEvent(
  params: Omit<StepEvent, 'event_type'>
): StepEvent {
  return {
    ...params,
    event_type: EventType.STEP,
  };
}

export function createProcessEndEvent(
  params: Omit<ProcessEndEvent, 'event_type'>
): ProcessEndEvent {
  return {
    ...params,
    event_type: EventType.PROCESS_END,
  };
}

export function createErrorEvent(
  params: Omit<ErrorEvent, 'event_type' | 'event_status'>
): ErrorEvent {
  return {
    ...params,
    event_type: EventType.ERROR,
    event_status: EventStatus.FAILURE,
  };
}

/**
 * Helper to generate a good summary from event data.
 */
export function generateSummary(params: {
  action: string;
  target?: string;
  outcome: string;
  details?: string;
}): string {
  const { action, target, outcome, details } = params;
  let summary = action;
  if (target) summary += ` ${target}`;
  summary += ` - ${outcome}`;
  if (details) summary += ` (${details})`;
  return summary;
}
```

---

## Example: Employee Card Origination Flow

This example demonstrates the complete event logging flow for an employee card origination process, including parallel steps and proper span hierarchy.

### Process Definition

```
Process name: EMPLOYEE_CARD_ORIGINATION
Description: Apply an internal employee for a credit card

Steps:
  Step 1: HR Validation (verify employee exists in Workday)
  Step 2a: Create entry for user in ODS (data system)      ┐
  Step 2b: Initialize Application Regulatory Controls      ├── Run in parallel
  Step 3: Regulatory/Background Checks via API
  Step 4: Call ADM (Ace Decision Matrix) for decision
  Step 5: Return response (Approved/Declined/Referred)
```

### Identifiers for This Flow

```
correlation_id: "corr-emp-20250126-a1b2c3"  ← One for this application
trace_id: "4bf92f3577b34da6a3ce929d0e0e4736"  ← One for the entire /apply request
account_id: NULL  ← Origination, no account exists yet
process_name: "EMPLOYEE_CARD_ORIGINATION"
```

### Span Hierarchy Diagram

```
span-0001 (PROCESS_START) ─────────────────────────────────────────────┐
    │                                                                  │
    └──▶ span-0002 (HR Validation)                                     │
              │                                                        │
              ├──▶ span-0003 (ODS Entry)        ┐                      │
              │    step_sequence: 2             │                      │
              │                                 ├── parallel           │
              ├──▶ span-0004 (Regulatory Init)  ┘                      │
              │    step_sequence: 2                                    │
              │                                                        │
              └──▶ span-0005 (Background Checks)                       │
                   parent_span_id: span-0002                           │
                   span_links: ["span-0003", "span-0004"]              │
                        │                                              │
                        └──▶ span-0006 (ADM Decision)                  │
                                                                       │
    ◀───────────────────── span-0007 (PROCESS_END) ────────────────────┘
                          parent_span_id: span-0001
```

### Event 1: Process Start

```typescript
{
  event_log_id: 1,
  correlation_id: "corr-emp-20250126-a1b2c3",
  trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
  span_id: "a1b2c3d4e5f60001",
  parent_span_id: null,
  span_links: null,
  batch_id: null,
  account_id: null,
  application_id: "employee-origination-service",
  originating_system: "HR_PORTAL",
  target_system: "EMPLOYEE_ORIGINATION_SERVICE",
  process_name: "EMPLOYEE_CARD_ORIGINATION",
  step_sequence: 0,
  step_name: null,
  event_type: "PROCESS_START",
  event_status: "IN_PROGRESS",
  identifiers: {
    employee_id: "EMP-456",
    session_id: "sess-xyz"
  },
  summary: "Employee card origination initiated for employee EMP-456 via HR portal",
  result: "INITIATED",
  endpoint: "/api/v1/employee/apply",
  http_method: "POST",
  event_timestamp: "2025-01-26T10:00:00.000Z"
}
```

### Event 2: HR Validation (Step 1)

```typescript
{
  event_log_id: 2,
  correlation_id: "corr-emp-20250126-a1b2c3",
  trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
  span_id: "a1b2c3d4e5f60002",
  parent_span_id: "a1b2c3d4e5f60001",
  span_links: null,
  batch_id: null,
  account_id: null,
  application_id: "employee-origination-service",
  originating_system: "EMPLOYEE_ORIGINATION_SERVICE",
  target_system: "WORKDAY",
  process_name: "EMPLOYEE_CARD_ORIGINATION",
  step_sequence: 1,
  step_name: "HR Validation",
  event_type: "STEP",
  event_status: "SUCCESS",
  identifiers: {
    employee_id: "EMP-456",
    workday_ref: "WD-789012"
  },
  summary: "Validated employee EMP-456 exists in Workday - active status confirmed, hire date 2022-03-15, department: Engineering",
  result: "EMPLOYEE_VERIFIED",
  endpoint: "/api/v1/employees/EMP-456/verify",
  http_method: "GET",
  http_status_code: 200,
  execution_time_ms: 245,
  event_timestamp: "2025-01-26T10:00:00.250Z"
}
```

### Event 3a: Create ODS Entry (Step 2 - Parallel)

```typescript
{
  event_log_id: 3,
  correlation_id: "corr-emp-20250126-a1b2c3",
  trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
  span_id: "a1b2c3d4e5f60003",
  parent_span_id: "a1b2c3d4e5f60002",
  span_links: null,
  batch_id: null,
  account_id: null,
  application_id: "employee-origination-service",
  originating_system: "EMPLOYEE_ORIGINATION_SERVICE",
  target_system: "ODS",
  process_name: "EMPLOYEE_CARD_ORIGINATION",
  step_sequence: 2,  // Same as 3b - indicates parallel
  step_name: "Create ODS Entry",
  event_type: "STEP",
  event_status: "SUCCESS",
  identifiers: {
    employee_id: "EMP-456",
    ods_record_id: "ODS-334455"
  },
  summary: "Created ODS record ODS-334455 for employee EMP-456 - applicant profile initialized",
  result: "ODS_RECORD_CREATED",
  endpoint: "/api/v1/applicants",
  http_method: "POST",
  http_status_code: 201,
  execution_time_ms: 180,
  event_timestamp: "2025-01-26T10:00:00.500Z"
}
```

### Event 3b: Initialize Regulatory Controls (Step 2 - Parallel)

```typescript
{
  event_log_id: 4,
  correlation_id: "corr-emp-20250126-a1b2c3",
  trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
  span_id: "a1b2c3d4e5f60004",
  parent_span_id: "a1b2c3d4e5f60002",
  span_links: null,
  batch_id: null,
  account_id: null,
  application_id: "employee-origination-service",
  originating_system: "EMPLOYEE_ORIGINATION_SERVICE",
  target_system: "COMPLIANCE_SERVICE",
  process_name: "EMPLOYEE_CARD_ORIGINATION",
  step_sequence: 2,  // Same as 3a - indicates parallel
  step_name: "Initialize Regulatory Controls",
  event_type: "STEP",
  event_status: "SUCCESS",
  identifiers: {
    employee_id: "EMP-456",
    compliance_case_id: "COMP-667788"
  },
  summary: "Initialized regulatory controls case COMP-667788 for employee EMP-456 - OFAC/KYC checks queued",
  result: "CONTROLS_INITIALIZED",
  endpoint: "/api/v1/compliance/initialize",
  http_method: "POST",
  http_status_code: 201,
  execution_time_ms: 95,
  event_timestamp: "2025-01-26T10:00:00.500Z"
}
```

### Event 4: Background/Regulatory Checks (Step 3) - Fork-Join

```typescript
{
  event_log_id: 5,
  correlation_id: "corr-emp-20250126-a1b2c3",
  trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
  span_id: "a1b2c3d4e5f60005",
  parent_span_id: "a1b2c3d4e5f60002",  // Points to orchestrator
  span_links: ["a1b2c3d4e5f60003", "a1b2c3d4e5f60004"],  // Waited for both parallel steps
  batch_id: null,
  account_id: null,
  application_id: "employee-origination-service",
  originating_system: "COMPLIANCE_SERVICE",
  target_system: "BACKGROUND_CHECK_VENDOR",
  process_name: "EMPLOYEE_CARD_ORIGINATION",
  step_sequence: 3,
  step_name: "Background and Regulatory Checks",
  event_type: "STEP",
  event_status: "SUCCESS",
  identifiers: {
    employee_id: "EMP-456",
    compliance_case_id: "COMP-667788",
    vendor_reference_id: "BGC-112233"
  },
  summary: "Background and regulatory checks completed for employee EMP-456 - OFAC clear, no adverse findings, risk score: LOW",
  result: "CHECKS_PASSED",
  endpoint: "/api/v2/background-check/execute",
  http_method: "POST",
  http_status_code: 200,
  execution_time_ms: 1850,
  event_timestamp: "2025-01-26T10:00:02.550Z"
}
```

### Event 5: ADM Decision Request (Step 4)

```typescript
{
  event_log_id: 6,
  correlation_id: "corr-emp-20250126-a1b2c3",
  trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
  span_id: "a1b2c3d4e5f60006",
  parent_span_id: "a1b2c3d4e5f60005",
  span_links: null,
  batch_id: null,
  account_id: null,
  application_id: "employee-origination-service",
  originating_system: "EMPLOYEE_ORIGINATION_SERVICE",
  target_system: "ADM",
  process_name: "EMPLOYEE_CARD_ORIGINATION",
  step_sequence: 4,
  step_name: "ADM Decision",
  event_type: "STEP",
  event_status: "SUCCESS",
  identifiers: {
    employee_id: "EMP-456",
    application_id: "APP-998877",
    adm_decision_id: "DEC-445566"
  },
  summary: "Submitted application APP-998877 to Ace Decision Matrix for employee EMP-456 - decision rendered: APPROVED, credit limit $10,000",
  result: "APPROVED",
  endpoint: "/api/v1/decisions/evaluate",
  http_method: "POST",
  http_status_code: 200,
  execution_time_ms: 620,
  event_timestamp: "2025-01-26T10:00:03.200Z"
}
```

### Event 6: Process End (Step 5)

```typescript
{
  event_log_id: 7,
  correlation_id: "corr-emp-20250126-a1b2c3",
  trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
  span_id: "a1b2c3d4e5f60007",
  parent_span_id: "a1b2c3d4e5f60001",  // Returns to root
  span_links: null,
  batch_id: null,
  account_id: null,
  application_id: "employee-origination-service",
  originating_system: "EMPLOYEE_ORIGINATION_SERVICE",
  target_system: "HR_PORTAL",
  process_name: "EMPLOYEE_CARD_ORIGINATION",
  step_sequence: 5,
  step_name: "Return Decision",
  event_type: "PROCESS_END",
  event_status: "SUCCESS",
  identifiers: {
    employee_id: "EMP-456",
    application_id: "APP-998877",
    adm_decision_id: "DEC-445566"
  },
  summary: "Employee card origination completed for EMP-456 - APPROVED with $10,000 limit, card to be issued to office address",
  result: "COMPLETED_APPROVED",
  http_status_code: 200,
  execution_time_ms: 3200,  // Total process time
  event_timestamp: "2025-01-26T10:00:03.250Z"
}
```

### Post-Approval: Create Correlation Link

Once the account is provisioned downstream:

```typescript
const correlationLink: CreateCorrelationLinkRequest = {
  correlation_id: 'corr-emp-20250126-a1b2c3',
  account_id: 'AC-EMP-001234',
  application_id: 'APP-998877',
  customer_id: 'EMP-456',
};
```

---

## Example: Batch Upload Flow

When processing a CSV upload of 100 employee applications:

### Batch Visualization

```
POST /api/v1/employee/apply/batch
│
├── batch_id: "batch-20250126-hr-upload-x7y8z9"
│
├── Row 1 ─────────────────────────────────────────────────────────────
│   correlation_id: "corr-emp-001"
│   trace_id: "trace-aaa111"
│   └── Events 1-7 (full EMPLOYEE_CARD_ORIGINATION flow)
│
├── Row 2 ─────────────────────────────────────────────────────────────
│   correlation_id: "corr-emp-002"
│   trace_id: "trace-bbb222"
│   └── Events 1-7
│
├── Row 3 ─────────────────────────────────────────────────────────────
│   correlation_id: "corr-emp-003"
│   trace_id: "trace-ccc333"
│   └── Events 1-4, then ERROR (failed at background check)
│
│   ... (rows 4-99) ...
│
└── Row 100 ───────────────────────────────────────────────────────────
    correlation_id: "corr-emp-100"
    trace_id: "trace-zzz999"
    └── Events 1-7
```

### Batch Event Example

Each event in the batch includes the shared `batch_id`:

```typescript
{
  event_log_id: 501,
  correlation_id: "corr-emp-042",
  trace_id: "trace-mmm042",
  span_id: "span-042-001",
  batch_id: "batch-20250126-hr-upload-x7y8z9",  // Shared across all 100
  // ... rest of event fields
}
```

---

## Query Patterns

### Get all events for an account (including pre-account origination)

```sql
SELECT e.*
FROM event_logs e
LEFT JOIN correlation_links cl ON e.correlation_id = cl.correlation_id
WHERE e.account_id = @account_id
   OR cl.account_id = @account_id
ORDER BY e.event_timestamp;
```

### Get all events for a correlation ID

```sql
SELECT e.*, cl.account_id as linked_account_id
FROM event_logs e
LEFT JOIN correlation_links cl ON e.correlation_id = cl.correlation_id
WHERE e.correlation_id = @correlation_id
ORDER BY e.step_sequence, e.event_timestamp;
```

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
    SUM(CASE WHEN event_type = 'PROCESS_START' AND event_status = 'IN_PROGRESS' 
             AND correlation_id NOT IN (
                 SELECT correlation_id FROM event_logs 
                 WHERE batch_id = @batch_id AND event_type = 'PROCESS_END'
             ) THEN 1 ELSE 0 END) as in_progress,
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

### Reconstruct trace with span hierarchy

```sql
WITH SpanHierarchy AS (
    SELECT 
        span_id,
        parent_span_id,
        JSON_QUERY(span_links) as span_links,
        step_sequence,
        step_name,
        event_type,
        event_status,
        execution_time_ms,
        event_timestamp
    FROM event_logs
    WHERE trace_id = @trace_id
)
SELECT * FROM SpanHierarchy
ORDER BY step_sequence, event_timestamp;
```

### Full-text search on summaries (SQL Server)

```sql
SELECT e.*
FROM event_logs e
WHERE e.account_id = @account_id
  AND CONTAINS(e.summary, @search_terms)
ORDER BY e.event_timestamp DESC;
```

### Get AI context for an account (summaries only)

```sql
SELECT
    e.event_timestamp,
    e.process_name,
    e.step_name,
    e.summary,
    e.event_status
FROM event_logs e
LEFT JOIN correlation_links cl ON e.correlation_id = cl.correlation_id
WHERE e.account_id = @account_id
   OR cl.account_id = @account_id
ORDER BY e.event_timestamp;
```

### Get failed processes in last 24 hours

```sql
SELECT
    process_name,
    COUNT(*) as failure_count,
    AVG(execution_time_ms) as avg_duration_ms
FROM event_logs
WHERE event_type = 'PROCESS_END'
  AND event_status = 'FAILURE'
  AND event_timestamp > DATEADD(hour, -24, GETUTCDATE())
GROUP BY process_name
ORDER BY failure_count DESC;
```

### Find all origination events for an account

```sql
SELECT e.*
FROM event_logs e
INNER JOIN correlation_links cl ON e.correlation_id = cl.correlation_id
WHERE cl.account_id = @account_id
  AND e.account_id IS NULL
ORDER BY e.event_timestamp;
```

---

## REST API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/healthcheck` | Liveness probe — pre-computed static response (no DB call) |
| GET | `/v1/healthcheck/ready` | Readiness probe (executes `SELECT 1`, 3s timeout) |
| GET | `/v1/version` | API version — pre-computed from `package.json` at startup |
| POST | `/v1/events` | Insert event(s) — single or array with per-item errors |
| POST | `/v1/events/batch` | Batch insert events with per-item error reporting |
| POST | `/v1/events/batch/upload` | Upload batch with shared batch_id |
| GET | `/v1/events/batch/{batch_id}` | Paginated events for a batch with aggregate stats |
| GET | `/v1/events/batch/{batch_id}/summary` | Aggregate batch statistics |
| GET | `/v1/events/account/{account_id}` | Paginated timeline for account |
| GET | `/v1/events/account/{account_id}/summary` | Pre-aggregated account summary |
| GET | `/v1/events/correlation/{correlation_id}` | Paginated events by correlation ID |
| GET | `/v1/events/trace/{trace_id}` | Paginated events by trace ID |
| POST | `/v1/events/search/text` | Constrained full-text search on summary |
| POST | `/v1/events/lookup` | **v1.5:** Fast structured event lookup by account/process |
| POST | `/v1/correlation-links` | Create correlation link |
| GET | `/v1/correlation-links/{correlation_id}` | Get correlation link |
| GET | `/v1/processes` | List process definitions |
| POST | `/v1/processes` | Register new process |

---

## OpenTelemetry Alignment

This schema is designed for compatibility with OpenTelemetry and observability tools like Datadog, Dynatrace, Jaeger, and Zipkin.

| OTel Concept | Schema Field | Notes |
|--------------|--------------|-------|
| Trace ID | `trace_id` | One per user action/request boundary. Propagates via `traceparent` header. |
| Span ID | `span_id` | One per operation within a trace. |
| Parent Span ID | `parent_span_id` | Direct causal parent — creates the call tree. |
| Span Links | `span_links` | Non-parent causal relationships (fork-join pattern). |
| — | `correlation_id` | Business process grouping (outside OTel scope). |
| — | `batch_id` | Batch operation grouping (outside OTel scope). |

### W3C Trace Context Propagation

When your service calls another service, propagate trace context via HTTP headers:

```
traceparent: 00-{trace_id}-{span_id}-01
```

Example:
```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-a1b2c3d4e5f60002-01
```

The receiving service:
1. Extracts `trace_id` from the header (continues the same trace)
2. Generates a new `span_id` for its operation
3. Sets `parent_span_id` to the received `span_id`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | — | Initial schema |
| 1.2 | — | Added correlation_links, process_definitions, account_timeline_summary, discriminated unions |
| 1.3 | — | Added required `summary` field for AI/human readable narratives, full-text search support |
| 1.4 | — | Added `batch_id` for batch operations, `span_links` for fork-join parallel dependencies (OpenTelemetry compliant), new batch API endpoints |
| 1.5 | Feb 2026 | Added `POST /v1/events/lookup` endpoint, pagination on correlation/trace endpoints, search guardrails, `COUNT(*) OVER()` single-query pagination, `GET /v1/healthcheck/ready`, `GET /v1/version`, health routes moved under `/v1`, array mode through batch service |
