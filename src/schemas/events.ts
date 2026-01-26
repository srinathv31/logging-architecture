import { z } from 'zod';
import { EVENT_TYPES, EVENT_STATUSES, HTTP_METHODS } from '../types/enums';
import { paginationQuerySchema, dateRangeQuerySchema, dateField } from './common';

export const eventLogEntrySchema = z.object({
  correlation_id: z.string().min(1).max(200),
  account_id: z.string().max(64).nullish(),
  trace_id: z.string().min(1).max(200),
  span_id: z.string().max(64).optional(),
  parent_span_id: z.string().max(64).optional(),
  application_id: z.string().min(1).max(200),
  target_system: z.string().min(1).max(200),
  originating_system: z.string().min(1).max(200),
  process_name: z.string().min(1).max(510),
  step_sequence: z.number().int().min(0).optional(),
  step_name: z.string().max(510).optional(),
  event_type: z.enum(EVENT_TYPES),
  event_status: z.enum(EVENT_STATUSES),
  identifiers: z.record(z.unknown()),
  summary: z.string().min(1),
  result: z.string().min(1).max(2048),
  metadata: z.record(z.unknown()).optional(),
  event_timestamp: z.string().datetime({ offset: true }),
  execution_time_ms: z.number().int().min(0).optional(),
  endpoint: z.string().max(510).optional(),
  http_method: z.enum(HTTP_METHODS).optional(),
  http_status_code: z.number().int().min(100).max(599).optional(),
  error_code: z.string().max(100).optional(),
  error_message: z.string().max(2048).optional(),
  request_payload: z.string().optional(),
  response_payload: z.string().optional(),
  idempotency_key: z.string().max(128).optional(),
});

export const createEventRequestSchema = z.object({
  events: z.union([eventLogEntrySchema, z.array(eventLogEntrySchema).min(1)]),
});

export const batchCreateEventRequestSchema = z.object({
  events: z.array(eventLogEntrySchema).min(1),
});

export const getEventsByAccountQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    process_name: z.string().optional(),
    event_status: z.enum(EVENT_STATUSES).optional(),
    include_linked: z
      .union([z.boolean(), z.string().transform((v) => v === 'true')])
      .default(false),
  });

export const textSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    account_id: z.string().max(64).optional(),
    process_name: z.string().max(510).optional(),
  })
  .merge(dateRangeQuerySchema)
  .merge(paginationQuerySchema);

// ---- Response Schemas ----

export const eventLogResponseSchema = z.object({
  eventLogId: z.number(),
  executionId: z.string(),
  correlationId: z.string(),
  accountId: z.string().nullable(),
  traceId: z.string(),
  spanId: z.string().nullable(),
  parentSpanId: z.string().nullable(),
  applicationId: z.string(),
  targetSystem: z.string(),
  originatingSystem: z.string(),
  processName: z.string(),
  stepSequence: z.number().nullable(),
  stepName: z.string().nullable(),
  eventType: z.string(),
  eventStatus: z.string(),
  identifiers: z.unknown(),
  summary: z.string(),
  result: z.string(),
  metadata: z.unknown(),
  eventTimestamp: dateField,
  createdAt: dateField,
  executionTimeMs: z.number().nullable(),
  endpoint: z.string().nullable(),
  httpStatusCode: z.number().nullable(),
  httpMethod: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  requestPayload: z.string().nullable(),
  responsePayload: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  isDeleted: z.boolean(),
});

export const createEventResponseSchema = z.object({
  success: z.boolean(),
  execution_ids: z.array(z.string()),
  correlation_id: z.string(),
});

export const batchCreateEventResponseSchema = z.object({
  success: z.boolean(),
  total_received: z.number().int(),
  total_inserted: z.number().int(),
  execution_ids: z.array(z.string()),
  errors: z
    .array(
      z.object({
        index: z.number().int(),
        error: z.string(),
      }),
    )
    .optional(),
});

export const getEventsByAccountResponseSchema = z.object({
  account_id: z.string(),
  events: z.array(eventLogResponseSchema),
  total_count: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  has_more: z.boolean(),
});

export const getEventsByTraceResponseSchema = z.object({
  trace_id: z.string(),
  events: z.array(eventLogResponseSchema),
  systems_involved: z.array(z.string()),
  total_duration_ms: z.number().nullable(),
});

export const getEventsByCorrelationResponseSchema = z.object({
  correlation_id: z.string(),
  account_id: z.string().nullable(),
  events: z.array(eventLogResponseSchema),
  is_linked: z.boolean(),
});

export const accountSummaryResponseSchema = z.object({
  summary: z.object({
    account_id: z.string(),
    first_event_at: z.string(),
    last_event_at: z.string(),
    total_events: z.number().int(),
    total_processes: z.number().int(),
    error_count: z.number().int(),
    last_process: z.string().nullable(),
    systems_touched: z.array(z.string()).nullable(),
    correlation_ids: z.array(z.string()).nullable(),
    updated_at: z.string(),
  }),
  recent_events: z.array(eventLogResponseSchema),
  recent_errors: z.array(eventLogResponseSchema),
});

export const textSearchResponseSchema = z.object({
  query: z.string(),
  events: z.array(eventLogResponseSchema),
  total_count: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
});
