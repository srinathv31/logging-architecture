# Event Log API - Complete Schema & Interfaces
## Version 1.3 (with account_id as Central Identifier + AI Summary Field)

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

## Changelog from v1.2

- **Added `summary` field** (NVARCHAR(MAX), required) - Human and AI readable narrative describing what happened in this event. This field is optimized for AI context retrieval and should contain a complete, standalone description.

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
| `application_id` | NVARCHAR(200) | **Yes** | — | Source application identifier |
| `target_system` | NVARCHAR(200) | **Yes** | — | Target system being called |
| `originating_system` | NVARCHAR(200) | **Yes** | — | System that initiated the process |
| `process_name` | NVARCHAR(510) | **Yes** | — | Business process name (e.g., `ADD_AUTH_USER`) |
| `step_sequence` | INT | No | NULL | Step order within process (0, 1, 2...) |
| `step_name` | NVARCHAR(510) | No | NULL | Human-readable step description |
| `event_type` | NVARCHAR(50) | **Yes** | — | `PROCESS_START`, `STEP`, `PROCESS_END`, `ERROR` |
| `event_status` | NVARCHAR(50) | **Yes** | — | `SUCCESS`, `FAILURE`, `IN_PROGRESS`, `SKIPPED` |
| `identifiers` | NVARCHAR(MAX) | **Yes** | — | JSON object with all available business IDs |
| `summary` | NVARCHAR(MAX) | **Yes** | — | **Human/AI readable narrative of what happened** |
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
| `embedding_vector` | VECTOR(1536) | **Yes** | — | Embedding vector |
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
-- Version 1.3
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
    summary             NVARCHAR(MAX) NOT NULL,  -- NEW IN v1.3: AI/Human readable narrative
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

-- Full-text index on summary for AI text search (SQL Server)
-- Note: Requires a unique, non-nullable index. We create an explicit one for reliability.
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
    embedding_vector    VARBINARY(MAX) NOT NULL,  -- Platform-specific vector type
    embedding_text      NVARCHAR(MAX) NOT NULL,   -- Typically the summary field
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
// Version 1.3
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

// POST /api/v1/events
export interface CreateEventRequest {
  events: EventLogEntry | EventLogEntry[];
}

export interface CreateEventResponse {
  success: boolean;
  execution_ids: string[];
  correlation_id: string;
}

// POST /api/v1/events/batch
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

// GET /api/v1/events/account/{account_id}
export interface GetEventsByAccountRequest {
  account_id: string;
  start_date?: string;
  end_date?: string;
  process_name?: string;
  event_status?: EventStatus;
  include_linked?: boolean; // Include events from correlation_links
  page?: number;
  page_size?: number;
}

export interface GetEventsByAccountResponse {
  account_id: string;
  events: EventLogRecord[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// GET /api/v1/events/correlation/{correlation_id}
export interface GetEventsByCorrelationResponse {
  correlation_id: string;
  account_id?: string;
  events: EventLogRecord[];
  is_linked: boolean;
}

// GET /api/v1/events/trace/{trace_id}
export interface GetEventsByTraceResponse {
  trace_id: string;
  events: EventLogRecord[];
  systems_involved: string[];
  total_duration_ms?: number;
}

// POST /api/v1/events/search
export interface SemanticSearchRequest {
  query: string;
  account_id?: string;
  correlation_id?: string;
  process_name?: string;
  start_date?: string;
  end_date?: string;
  top_k?: number;
}

export interface SemanticSearchResponse {
  query: string;
  results: Array<{
    event: EventLogRecord;
    score: number;
    matched_text: string;
  }>;
}

// POST /api/v1/events/search/text (Full-text search on summary)
export interface TextSearchRequest {
  query: string;
  account_id?: string;
  process_name?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface TextSearchResponse {
  query: string;
  events: EventLogRecord[];
  total_count: number;
  page: number;
  page_size: number;
}

// POST /api/v1/correlation-links
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

// GET /api/v1/events/account/{account_id}/summary
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
  application_id: string;
  target_system: string;
  originating_system: string;
  process_name: string;
  identifiers: EventIdentifiers;
  summary: string;  // Required in v1.3
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
  execution_time_ms: number; // Required for process end
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
 * Use this as a template - customize for your specific use cases.
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

## Example Usage

### Origination Flow (account_id starts as null)

```typescript
import {
  createCorrelationId,
  createProcessStartEvent,
  createStepEvent,
  createProcessEndEvent,
  EventStatus,
} from './event-log-types';

const correlationId = createCorrelationId('orig');
const traceId = crypto.randomUUID();

// Event 1: Process Start (no account_id yet)
const startEvent = createProcessStartEvent({
  correlation_id: correlationId,
  account_id: null,
  trace_id: traceId,
  application_id: 'originations-service',
  target_system: 'SELF',
  originating_system: 'WEB_APP',
  process_name: 'CREDIT_CARD_APPLICATION',
  identifiers: {
    session_id: 'sess-abc123',
    ssn_last4: '1234',
  },
  summary: 'Initiated credit card application for customer (SSN ***1234) via web portal',
  result: 'INITIATED',
  event_timestamp: new Date().toISOString(),
});

// Event 2: Credit Check Step
const creditCheckEvent = createStepEvent({
  correlation_id: correlationId,
  account_id: null,
  trace_id: crypto.randomUUID(),
  span_id: 'span-001',
  application_id: 'originations-service',
  target_system: 'EXPERIAN',
  originating_system: 'WEB_APP',
  process_name: 'CREDIT_CARD_APPLICATION',
  step_sequence: 1,
  step_name: 'Credit bureau pull',
  event_status: EventStatus.SUCCESS,
  identifiers: {
    session_id: 'sess-abc123',
    experian_transaction_id: 'EXP-789456',
  },
  summary: 'Pulled credit report from Experian for applicant (SSN ***1234) - FICO score 742, no derogatory marks',
  result: 'FICO_742_CLEAN',
  execution_time_ms: 850,
  endpoint: '/v2/credit-report',
  http_method: 'POST',
  http_status_code: 200,
  event_timestamp: new Date().toISOString(),
});

// Event 3: Credit Decision Step
const decisionEvent = createStepEvent({
  correlation_id: correlationId,
  account_id: null,
  trace_id: crypto.randomUUID(),
  span_id: 'span-002',
  application_id: 'originations-service',
  target_system: 'CREDIT_DECISION_ENGINE',
  originating_system: 'WEB_APP',
  process_name: 'CREDIT_CARD_APPLICATION',
  step_sequence: 2,
  step_name: 'Credit decision',
  event_status: EventStatus.SUCCESS,
  identifiers: {
    session_id: 'sess-abc123',
    application_id: 'APP-456',
    decision_id: 'DEC-789',
  },
  summary: 'Credit decision rendered for application APP-456 - APPROVED with $5,000 credit limit, 19.99% APR',
  result: 'APPROVED_5000',
  execution_time_ms: 1250,
  event_timestamp: new Date().toISOString(),
});

// Event 4: Account Created (account_id now available!)
const accountCreatedEvent = createStepEvent({
  correlation_id: correlationId,
  account_id: 'AC-1234567890',  // NOW POPULATED
  trace_id: crypto.randomUUID(),
  span_id: 'span-003',
  application_id: 'originations-service',
  target_system: 'CARD_PROCESSOR',
  originating_system: 'WEB_APP',
  process_name: 'CREDIT_CARD_APPLICATION',
  step_sequence: 3,
  step_name: 'Account provisioning',
  event_status: EventStatus.SUCCESS,
  identifiers: {
    application_id: 'APP-456',
    card_number_last4: '9876',
  },
  summary: 'Account AC-1234567890 provisioned with card processor - card ending 9876 issued, $5,000 limit',
  result: 'ACCOUNT_CREATED',
  endpoint: '/v2/accounts/provision',
  http_method: 'POST',
  http_status_code: 201,
  execution_time_ms: 2100,
  event_timestamp: new Date().toISOString(),
});

// Event 5: Process End
const endEvent = createProcessEndEvent({
  correlation_id: correlationId,
  account_id: 'AC-1234567890',
  trace_id: crypto.randomUUID(),
  application_id: 'originations-service',
  target_system: 'SELF',
  originating_system: 'WEB_APP',
  process_name: 'CREDIT_CARD_APPLICATION',
  step_sequence: 4,
  event_status: EventStatus.SUCCESS,
  identifiers: {
    application_id: 'APP-456',
    card_number_last4: '9876',
  },
  summary: 'Credit card application APP-456 completed successfully - account AC-1234567890 created with $5,000 limit',
  result: 'COMPLETED',
  execution_time_ms: 5450, // Total process time
  event_timestamp: new Date().toISOString(),
});

// Create the correlation link (one-time operation)
const correlationLink: CreateCorrelationLinkRequest = {
  correlation_id: correlationId,
  account_id: 'AC-1234567890',
  application_id: 'APP-456',
  card_number_last4: '9876',
};
```

### Servicing Flow: Add Authorized User

```typescript
const correlationId = createCorrelationId('auth');
const accountId = 'AC-1234567890';

// Event 1: Process Start
const startEvent = createProcessStartEvent({
  correlation_id: correlationId,
  account_id: accountId,
  trace_id: crypto.randomUUID(),
  application_id: 'auth-user-service',
  target_system: 'SELF',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  identifiers: {
    auth_user_ssn_last4: '5678',
    primary_cardholder_id: 'CH-98765',
  },
  summary: 'Initiated Add Authorized User request for account AC-1234567890 - adding user with SSN ***5678',
  result: 'INITIATED',
  event_timestamp: new Date().toISOString(),
});

// Event 2: Validate against Experian
const experianEvent = createStepEvent({
  correlation_id: correlationId,
  account_id: accountId,
  trace_id: crypto.randomUUID(),
  span_id: 'span-001',
  application_id: 'auth-user-service',
  target_system: 'EXPERIAN',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  step_sequence: 1,
  step_name: 'Validate auth user identity',
  event_status: EventStatus.SUCCESS,
  identifiers: {
    auth_user_id: 'AU-111222',
    auth_user_ssn_last4: '5678',
    experian_transaction_id: 'EXP-333444',
  },
  summary: 'Validated authorized user Jane Doe (SSN ***5678) against Experian - identity confirmed, fraud score 0.08',
  result: 'IDENTITY_VERIFIED',
  endpoint: '/v2/identity/verify',
  http_method: 'POST',
  http_status_code: 200,
  execution_time_ms: 920,
  event_timestamp: new Date().toISOString(),
});

// Event 3: Update ODS
const odsEvent = createStepEvent({
  correlation_id: correlationId,
  account_id: accountId,
  trace_id: crypto.randomUUID(),
  span_id: 'span-002',
  application_id: 'auth-user-service',
  target_system: 'ODS',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  step_sequence: 2,
  step_name: 'Update ODS with auth user',
  event_status: EventStatus.SUCCESS,
  identifiers: {
    auth_user_id: 'AU-111222',
  },
  summary: 'Updated ODS database with authorized user AU-111222 linked to account AC-1234567890',
  result: 'ODS_UPDATED',
  execution_time_ms: 150,
  event_timestamp: new Date().toISOString(),
});

// Event 4: Regulatory Controls
const regulatoryEvent = createStepEvent({
  correlation_id: correlationId,
  account_id: accountId,
  trace_id: crypto.randomUUID(),
  span_id: 'span-003',
  application_id: 'auth-user-service',
  target_system: 'REGULATORY_ENGINE',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  step_sequence: 3,
  step_name: 'Regulatory compliance check',
  event_status: EventStatus.SUCCESS,
  identifiers: {
    auth_user_id: 'AU-111222',
  },
  summary: 'Regulatory controls passed for authorized user AU-111222 - OFAC clear, no CFPB restrictions',
  result: 'COMPLIANT',
  execution_time_ms: 340,
  event_timestamp: new Date().toISOString(),
});

// Event 5: Vendor API call
const vendorEvent = createStepEvent({
  correlation_id: correlationId,
  account_id: accountId,
  trace_id: crypto.randomUUID(),
  span_id: 'span-004',
  application_id: 'auth-user-service',
  target_system: 'CARD_PROCESSOR',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  step_sequence: 4,
  step_name: 'Add auth user via processor API',
  event_status: EventStatus.SUCCESS,
  identifiers: {
    auth_user_id: 'AU-111222',
    vendor_reference_id: 'PROC-555666',
  },
  summary: 'Added authorized user AU-111222 to account via card processor API - card ending 4321 will be issued',
  result: 'PROCESSOR_CONFIRMED',
  endpoint: '/v3/accounts/authorized-users',
  http_method: 'POST',
  http_status_code: 200,
  execution_time_ms: 1800,
  event_timestamp: new Date().toISOString(),
});

// Event 6: Process End
const endEvent = createProcessEndEvent({
  correlation_id: correlationId,
  account_id: accountId,
  trace_id: crypto.randomUUID(),
  application_id: 'auth-user-service',
  target_system: 'SELF',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  step_sequence: 5,
  event_status: EventStatus.SUCCESS,
  identifiers: {
    auth_user_id: 'AU-111222',
  },
  summary: 'Add Authorized User completed for account AC-1234567890 - Jane Doe (AU-111222) added successfully, card ending 4321 to be mailed',
  result: 'COMPLETED',
  execution_time_ms: 3210,
  event_timestamp: new Date().toISOString(),
});
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

### Trace a request across systems

```sql
SELECT
    e.step_sequence,
    e.step_name,
    e.target_system,
    e.event_status,
    e.summary,
    e.execution_time_ms,
    e.event_timestamp
FROM event_logs e
WHERE e.trace_id = @trace_id
ORDER BY e.event_timestamp;
```

### Find all origination events for an account

```sql
SELECT e.*
FROM event_logs e
INNER JOIN correlation_links cl ON e.correlation_id = cl.correlation_id
WHERE cl.account_id = @account_id
  AND e.account_id IS NULL  -- Events before account existed
ORDER BY e.event_timestamp;
```

---

## REST API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events` | Insert event(s) |
| POST | `/api/v1/events/batch` | Batch insert events |
| GET | `/api/v1/events/account/{account_id}` | Get timeline for account |
| GET | `/api/v1/events/account/{account_id}/summary` | Get account summary |
| GET | `/api/v1/events/correlation/{correlation_id}` | Get events by correlation ID |
| GET | `/api/v1/events/trace/{trace_id}` | Get events by trace ID |
| POST | `/api/v1/events/search` | Semantic search (vector) |
| POST | `/api/v1/events/search/text` | Full-text search on summary |
| POST | `/api/v1/correlation-links` | Create correlation link |
| GET | `/api/v1/correlation-links/{correlation_id}` | Get correlation link |
| GET | `/api/v1/processes` | List process definitions |
| POST | `/api/v1/processes` | Register new process |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | - | Initial schema |
| 1.2 | - | Added correlation_links, process_definitions, account_timeline_summary, discriminated unions |
| 1.3 | - | Added required `summary` field for AI/human readable narratives, full-text search support |
