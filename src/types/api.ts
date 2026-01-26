import type { EventLog } from '../db/schema/index';
import type { EventStatus } from './enums';

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
  errors?: Array<{ index: number; error: string }>;
}

// GET /api/v1/events/account/:accountId
export interface GetEventsByAccountRequest {
  account_id: string;
  start_date?: string;
  end_date?: string;
  process_name?: string;
  event_status?: EventStatus;
  include_linked?: boolean;
  page?: number;
  page_size?: number;
}

export interface GetEventsByAccountResponse {
  account_id: string;
  events: EventLog[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// GET /api/v1/events/correlation/:correlationId
export interface GetEventsByCorrelationResponse {
  correlation_id: string;
  account_id?: string | null;
  events: EventLog[];
  is_linked: boolean;
}

// GET /api/v1/events/trace/:traceId
export interface GetEventsByTraceResponse {
  trace_id: string;
  events: EventLog[];
  systems_involved: string[];
  total_duration_ms?: number | null;
}

// POST /api/v1/events/search/text
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
  events: EventLog[];
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

// GET /api/v1/events/account/:accountId/summary
export interface GetAccountSummaryResponse {
  summary: {
    account_id: string;
    first_event_at: string;
    last_event_at: string;
    total_events: number;
    total_processes: number;
    error_count: number;
    last_process?: string | null;
    systems_touched?: string[] | null;
    correlation_ids?: string[] | null;
    updated_at: string;
  };
  recent_events: EventLog[];
  recent_errors: EventLog[];
}

// Event log entry (for API input - doesn't include auto-generated fields)
export interface EventLogEntry {
  correlation_id: string;
  account_id?: string | null;
  trace_id: string;
  span_id?: string;
  parent_span_id?: string;
  application_id: string;
  target_system: string;
  originating_system: string;
  process_name: string;
  step_sequence?: number;
  step_name?: string;
  event_type: string;
  event_status: string;
  identifiers: Record<string, unknown>;
  summary: string;
  result: string;
  metadata?: Record<string, unknown>;
  event_timestamp: string;
  execution_time_ms?: number;
  endpoint?: string;
  http_method?: string;
  http_status_code?: number;
  error_code?: string;
  error_message?: string;
  request_payload?: string;
  response_payload?: string;
  idempotency_key?: string;
}
