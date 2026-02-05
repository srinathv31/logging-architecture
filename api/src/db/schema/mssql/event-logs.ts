import {
  mssqlTable,
  bigint,
  varchar,
  nvarchar,
  int,
  bit,
  datetime2,
  check,
} from 'drizzle-orm/mssql-core';
import { sql } from 'drizzle-orm';

export const eventLogs = mssqlTable(
  'event_log',
  {
    eventLogId: bigint('event_log_id', { mode: 'number' }).identity().primaryKey(),
    executionId: varchar('execution_id', { length: 36 }).default(sql`LOWER(CONVERT(VARCHAR(36), NEWID()))`).notNull(),

    // Core identifiers
    correlationId: varchar('correlation_id', { length: 200 }).notNull(),
    accountId: varchar('account_id', { length: 64 }),
    traceId: varchar('trace_id', { length: 200 }).notNull(),
    spanId: varchar('span_id', { length: 64 }),
    parentSpanId: varchar('parent_span_id', { length: 64 }),
    spanLinks: nvarchar('span_links', { length: 'max', mode: 'json' }),
    batchId: varchar('batch_id', { length: 200 }),

    // System context
    applicationId: varchar('application_id', { length: 200 }).notNull(),
    targetSystem: varchar('target_system', { length: 200 }).notNull(),
    originatingSystem: varchar('originating_system', { length: 200 }).notNull(),

    // Process details
    processName: varchar('process_name', { length: 510 }).notNull(),
    stepSequence: int('step_sequence'),
    stepName: varchar('step_name', { length: 510 }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventStatus: varchar('event_status', { length: 50 }).notNull(),

    // Business data
    identifiers: nvarchar('identifiers', { length: 'max', mode: 'json' }).notNull(),
    summary: nvarchar('summary', { length: 'max' }).notNull(),
    result: varchar('result', { length: 2048 }).notNull(),
    metadata: nvarchar('metadata', { length: 'max', mode: 'json' }),

    // Timing
    eventTimestamp: datetime2('event_timestamp', { precision: 3 }).notNull(),
    createdAt: datetime2('created_at', { precision: 3 }).default(sql`GETUTCDATE()`).notNull(),
    executionTimeMs: int('execution_time_ms'),

    // HTTP details
    endpoint: varchar('endpoint', { length: 510 }),
    httpStatusCode: int('http_status_code'),
    httpMethod: varchar('http_method', { length: 20 }),

    // Error tracking
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: varchar('error_message', { length: 2048 }),

    // Payloads
    requestPayload: nvarchar('request_payload', { length: 'max' }),
    responsePayload: nvarchar('response_payload', { length: 'max' }),

    // Control fields
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    isDeleted: bit('is_deleted').default(false).notNull(),
  },
  (table) => [
    // Check constraints (indexes managed in drizzle-mssql/manual/001_indexes.sql)
    check(
      'ck_event_log_event_type',
      sql`${table.eventType} IN ('PROCESS_START', 'STEP', 'PROCESS_END', 'ERROR')`,
    ),
    check(
      'ck_event_log_event_status',
      sql`${table.eventStatus} IN ('SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED')`,
    ),
    check(
      'ck_event_log_http_method',
      sql`${table.httpMethod} IS NULL OR ${table.httpMethod} IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')`,
    ),
    check(
      'ck_event_log_span_links_json',
      sql`${table.spanLinks} IS NULL OR ISJSON(${table.spanLinks}) = 1`,
    ),
  ],
);
