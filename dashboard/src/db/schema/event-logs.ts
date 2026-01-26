import {
  pgTable,
  bigserial,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const eventLogs = pgTable(
  'event_logs',
  {
    eventLogId: bigserial('event_log_id', { mode: 'number' }).primaryKey(),
    executionId: uuid('execution_id').default(sql`gen_random_uuid()`).notNull(),

    // Core identifiers
    correlationId: varchar('correlation_id', { length: 200 }).notNull(),
    accountId: varchar('account_id', { length: 64 }),
    traceId: varchar('trace_id', { length: 200 }).notNull(),
    spanId: varchar('span_id', { length: 64 }),
    parentSpanId: varchar('parent_span_id', { length: 64 }),
    spanLinks: jsonb('span_links'),
    batchId: varchar('batch_id', { length: 200 }),

    // System context
    applicationId: varchar('application_id', { length: 200 }).notNull(),
    targetSystem: varchar('target_system', { length: 200 }).notNull(),
    originatingSystem: varchar('originating_system', { length: 200 }).notNull(),

    // Process details
    processName: varchar('process_name', { length: 510 }).notNull(),
    stepSequence: integer('step_sequence'),
    stepName: varchar('step_name', { length: 510 }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventStatus: varchar('event_status', { length: 50 }).notNull(),

    // Business data
    identifiers: jsonb('identifiers').notNull(),
    summary: text('summary').notNull(),
    result: varchar('result', { length: 2048 }).notNull(),
    metadata: jsonb('metadata'),

    // Timing
    eventTimestamp: timestamp('event_timestamp', { withTimezone: false }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
    executionTimeMs: integer('execution_time_ms'),

    // HTTP details
    endpoint: varchar('endpoint', { length: 510 }),
    httpStatusCode: integer('http_status_code'),
    httpMethod: varchar('http_method', { length: 20 }),

    // Error tracking
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: varchar('error_message', { length: 2048 }),

    // Payloads
    requestPayload: text('request_payload'),
    responsePayload: text('response_payload'),

    // Control fields
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    isDeleted: boolean('is_deleted').default(false).notNull(),
  },
  (table) => [
    check(
      'ck_event_logs_event_type',
      sql`${table.eventType} IN ('PROCESS_START', 'STEP', 'PROCESS_END', 'ERROR')`,
    ),
    check(
      'ck_event_logs_event_status',
      sql`${table.eventStatus} IN ('SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED')`,
    ),
    check(
      'ck_event_logs_http_method',
      sql`${table.httpMethod} IS NULL OR ${table.httpMethod} IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')`,
    ),
    index('ix_event_logs_correlation_id').on(table.correlationId, table.eventTimestamp),
    index('ix_event_logs_account_id')
      .on(table.accountId)
      .where(sql`${table.accountId} IS NOT NULL`),
    index('ix_event_logs_trace_id').on(table.traceId),
    index('ix_event_logs_process').on(table.processName, table.eventTimestamp),
    index('ix_event_logs_timestamp').on(table.eventTimestamp),
    index('ix_event_logs_status')
      .on(table.eventStatus, table.eventTimestamp)
      .where(sql`${table.eventStatus} = 'FAILURE'`),
    index('ix_event_logs_target_system').on(table.targetSystem, table.eventTimestamp),
    uniqueIndex('ix_event_logs_idempotency')
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    index('ix_event_logs_batch_id')
      .on(table.batchId, table.correlationId)
      .where(sql`${table.batchId} IS NOT NULL`),
  ],
);
