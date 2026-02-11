// ============================================================================
// EVENT LOG SDK - UTILITIES
// ============================================================================

import { EventLogEntry, EventType, EventStatus } from '../models/types';

// ----------------------------------------------------------------------------
// ID Generation
// ----------------------------------------------------------------------------

/**
 * Generate a correlation ID with optional prefix
 * @param prefix - Prefix for the ID (default: 'corr')
 * @returns Unique correlation ID in format "{prefix}-{timestamp}-{random}"
 */
export function createCorrelationId(prefix: string = 'corr'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate a batch ID for grouping multiple process instances
 * @param source - Source identifier (e.g., 'hr-upload', 'csv-import')
 * @returns Unique batch ID in format "batch-{YYYYMMDD}-{source}-{random}"
 */
export function createBatchId(source: string = 'batch'): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8);
  return `batch-${date}-${source}-${random}`;
}

/**
 * Generate a W3C-compliant trace ID (32 hex characters)
 */
export function createTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generate a span ID (16 hex characters)
 */
export function createSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
}

// ----------------------------------------------------------------------------
// Event Builder Functions
// ----------------------------------------------------------------------------

type BaseEventParams = Omit<
  EventLogEntry,
  'event_type' | 'event_status' | 'step_sequence' | 'event_timestamp' | 'identifiers'
> & {
  identifiers?: EventLogEntry['identifiers'];
};

/**
 * Create a PROCESS_START event
 */
export function createProcessStartEvent(
  params: Omit<BaseEventParams, 'step_name' | 'execution_time_ms'>
): EventLogEntry {
  return {
    ...params,
    event_type: EventType.PROCESS_START,
    event_status: EventStatus.IN_PROGRESS,
    step_sequence: 0,
    identifiers: params.identifiers ?? {},
    event_timestamp: new Date().toISOString(),
  };
}

/**
 * Create a STEP event
 */
export function createStepEvent(
  params: Omit<EventLogEntry, 'event_type' | 'event_timestamp'> & {
    event_timestamp?: string;
  }
): EventLogEntry {
  return {
    ...params,
    event_type: EventType.STEP,
    event_timestamp: params.event_timestamp ?? new Date().toISOString(),
  };
}

/**
 * Create a PROCESS_END event
 */
export function createProcessEndEvent(
  params: Omit<EventLogEntry, 'event_type' | 'event_timestamp'> & {
    event_timestamp?: string;
    event_status: typeof EventStatus.SUCCESS | typeof EventStatus.FAILURE;
    execution_time_ms: number;
  }
): EventLogEntry {
  return {
    ...params,
    event_type: EventType.PROCESS_END,
    event_timestamp: params.event_timestamp ?? new Date().toISOString(),
  };
}

/**
 * Create an ERROR event
 */
export function createErrorEvent(
  params: Omit<EventLogEntry, 'event_type' | 'event_status' | 'event_timestamp'> & {
    error_code: string;
    error_message: string;
    event_timestamp?: string;
  }
): EventLogEntry {
  return {
    ...params,
    event_type: EventType.ERROR,
    event_status: EventStatus.FAILURE,
    event_timestamp: params.event_timestamp ?? new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Summary Helpers
// ----------------------------------------------------------------------------

/**
 * Generate a well-formed summary string
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

/**
 * Mask a value, showing only last 4 characters
 */
export function maskLast4(value: string): string {
  if (!value || value.length <= 4) return '****';
  return `***${value.slice(-4)}`;
}

// ----------------------------------------------------------------------------
// Payload Truncation
// ----------------------------------------------------------------------------

/**
 * Truncate a payload string if it exceeds maxBytes.
 * Uses byte length (UTF-8) for accuracy.
 */
export function truncatePayload(
  payload: string | undefined,
  maxBytes: number
): string | undefined {
  if (!payload) return payload;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);
  if (bytes.length <= maxBytes) return payload;

  // Binary search for the right character cutoff
  let lo = 0;
  let hi = payload.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (encoder.encode(payload.slice(0, mid)).length <= maxBytes - 11) {
      // 11 = "[TRUNCATED]".length
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return payload.slice(0, lo) + '[TRUNCATED]';
}

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

/**
 * Validate an EventLogEntry has all required fields
 */
export function validateEvent(event: Partial<EventLogEntry>): string[] {
  const errors: string[] = [];
  
  const required: (keyof EventLogEntry)[] = [
    'correlation_id',
    'trace_id',
    'application_id',
    'target_system',
    'originating_system',
    'process_name',
    'event_type',
    'event_status',
    'summary',
    'result',
  ];
  
  for (const field of required) {
    if (!event[field]) {
      errors.push(`${field} is required`);
    }
  }
  
  return errors;
}
