import { z } from 'zod';
import { EVENT_TYPES, EVENT_STATUSES, HTTP_METHODS } from '../types/enums';
import { paginationQuerySchema, dateRangeQuerySchema } from './common';

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
