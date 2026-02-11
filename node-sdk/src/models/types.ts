// ============================================================================
// EVENT LOG SDK - TYPESCRIPT MODELS
// Version 1.4
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
// Identifiers
// ----------------------------------------------------------------------------

export interface EventIdentifiers {
  // Origination phase
  session_id?: string;
  application_id?: string;
  decision_id?: string;

  // Account/Card identifiers
  card_id?: string;
  card_number_last4?: string;

  // Customer identifiers
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

  // Employee-specific
  employee_id?: string;
  workday_ref?: string;
  ods_record_id?: string;
  compliance_case_id?: string;
  adm_decision_id?: string;

  // Allow additional custom identifiers
  [key: string]: string | undefined;
}

// ----------------------------------------------------------------------------
// Event Log Entry
// ----------------------------------------------------------------------------

export interface EventLogEntry {
  // Core identifiers
  correlation_id: string;
  account_id?: string | null;
  trace_id: string;
  span_id?: string;
  parent_span_id?: string;
  span_links?: string[];
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
  summary: string;
  result: string;
  metadata?: Record<string, unknown>;

  // Timing
  event_timestamp: string;
  execution_time_ms?: number;

  // HTTP details
  endpoint?: string;
  http_method?: HttpMethod;
  http_status_code?: number;

  // Error tracking
  error_code?: string;
  error_message?: string;

  // Payloads
  request_payload?: string;
  response_payload?: string;

  // Deduplication
  idempotency_key?: string;
}

// ----------------------------------------------------------------------------
// Event Log Record (from DB)
// ----------------------------------------------------------------------------

export interface EventLogRecord extends EventLogEntry {
  event_log_id: number;
  execution_id: string;
  created_at: string;
  is_deleted: boolean;
}

// ----------------------------------------------------------------------------
// API Response Types
// ----------------------------------------------------------------------------

export interface CreateEventResponse {
  success: boolean;
  execution_ids: string[];
  correlation_id: string;
}

export interface BatchCreateEventResponse {
  success: boolean;
  total_received: number;
  total_inserted: number;
  execution_ids: string[];
  errors?: Array<{
    index: number;
    correlation_id?: string;
    error: string;
  }>;
}

export interface GetEventsByAccountResponse {
  account_id: string;
  events: EventLogRecord[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface GetEventsByCorrelationResponse {
  correlation_id: string;
  account_id?: string;
  events: EventLogRecord[];
  is_linked: boolean;
}

export interface GetEventsByTraceResponse {
  trace_id: string;
  events: EventLogRecord[];
  systems_involved: string[];
  total_duration_ms?: number;
}

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

export interface CreateCorrelationLinkResponse {
  success: boolean;
  correlation_id: string;
  account_id: string;
  linked_at: string;
}

// ----------------------------------------------------------------------------
// Client Configuration
// ----------------------------------------------------------------------------

export interface EventLogClientConfig {
  /** Base URL for the Event Log API (required) */
  baseUrl: string;
  
  /** 
   * Token provider for authentication (recommended)
   * Use OAuthTokenProvider for OAuth, or StaticTokenProvider for API keys
   */
  tokenProvider?: import('../client/TokenProvider').TokenProvider;
  
  /** 
   * API key for authentication (convenience, wraps in StaticTokenProvider)
   * @deprecated Use tokenProvider with OAuthTokenProvider for production
   */
  apiKey?: string;
  
  /** Default application ID to include in events */
  applicationId?: string;
  
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  
  /** Maximum retry attempts for failed requests (default: 3) */
  maxRetries?: number;
  
  /** Custom fetch implementation (for testing or custom environments) */
  fetch?: typeof fetch;

  /** Logger for SDK internal messages. Pass 'silent' to suppress all output. */
  logger?: import('../utils/logger').EventLogLogger | 'silent';
}

// ----------------------------------------------------------------------------
// Query Parameters
// ----------------------------------------------------------------------------

export interface GetEventsByAccountParams {
  start_date?: string;
  end_date?: string;
  process_name?: string;
  event_status?: EventStatus;
  include_linked?: boolean;
  page?: number;
  page_size?: number;
}

export interface GetEventsByBatchParams {
  event_status?: EventStatus;
  page?: number;
  page_size?: number;
}
