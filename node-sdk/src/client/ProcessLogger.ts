// ============================================================================
// PROCESS LOGGER - Scoped convenience methods for a single process
// ============================================================================

import { AsyncEventLogger } from './AsyncEventLogger';
import {
  EventLogEntry,
  EventType,
  EventStatus,
  EventIdentifiers,
  HttpMethod,
} from '../models/types';
import { createCorrelationId, createTraceId, createSpanId } from '../utils/helpers';

export interface ProcessLoggerConfig {
  logger: AsyncEventLogger;
  applicationId: string;
  targetSystem: string;
  originatingSystem: string;
  processName: string;
  accountId?: string | null;
  correlationId?: string;
  traceId?: string;
  batchId?: string;
  identifiers?: Record<string, string>;
}

/**
 * ProcessLogger provides scoped `logStart()`, `logStep()`, `logEnd()`, and `logError()`
 * methods that automatically fill in template fields.
 *
 * Created via `EventLogTemplate.forProcess()`.
 */
export class ProcessLogger {
  readonly correlationId: string;
  readonly traceId: string;
  private readonly config: ProcessLoggerConfig;

  constructor(config: ProcessLoggerConfig) {
    this.config = config;
    this.correlationId = config.correlationId ?? createCorrelationId();
    this.traceId = config.traceId ?? createTraceId();
  }

  /**
   * Log a PROCESS_START event (step_sequence = 0, status = IN_PROGRESS)
   */
  logStart(summary: string, result?: string): boolean {
    return this.log({
      event_type: EventType.PROCESS_START,
      event_status: EventStatus.IN_PROGRESS,
      step_sequence: 0,
      summary,
      result: result ?? summary,
    });
  }

  /**
   * Log a STEP event
   */
  logStep(
    stepSequence: number,
    stepName: string,
    eventStatus: EventStatus,
    summary: string,
    options?: {
      result?: string;
      spanId?: string;
      parentSpanId?: string;
      spanLinks?: string[];
      executionTimeMs?: number;
      endpoint?: string;
      httpMethod?: HttpMethod;
      httpStatusCode?: number;
      requestPayload?: string;
      responsePayload?: string;
      metadata?: Record<string, unknown>;
      errorCode?: string;
      errorMessage?: string;
    }
  ): boolean {
    return this.log({
      event_type: EventType.STEP,
      event_status: eventStatus,
      step_sequence: stepSequence,
      step_name: stepName,
      summary,
      result: options?.result ?? summary,
      span_id: options?.spanId ?? createSpanId(),
      parent_span_id: options?.parentSpanId,
      span_links: options?.spanLinks,
      execution_time_ms: options?.executionTimeMs,
      endpoint: options?.endpoint,
      http_method: options?.httpMethod,
      http_status_code: options?.httpStatusCode,
      request_payload: options?.requestPayload,
      response_payload: options?.responsePayload,
      metadata: options?.metadata,
      error_code: options?.errorCode,
      error_message: options?.errorMessage,
    });
  }

  /**
   * Log a PROCESS_END event
   */
  logEnd(
    eventStatus: typeof EventStatus.SUCCESS | typeof EventStatus.FAILURE,
    summary: string,
    executionTimeMs: number,
    result?: string
  ): boolean {
    return this.log({
      event_type: EventType.PROCESS_END,
      event_status: eventStatus,
      summary,
      result: result ?? summary,
      execution_time_ms: executionTimeMs,
    });
  }

  /**
   * Log an ERROR event (event_status = FAILURE)
   */
  logError(
    summary: string,
    errorCode: string,
    errorMessage: string,
    options?: {
      stepSequence?: number;
      stepName?: string;
      metadata?: Record<string, unknown>;
    }
  ): boolean {
    return this.log({
      event_type: EventType.ERROR,
      event_status: EventStatus.FAILURE,
      step_sequence: options?.stepSequence,
      step_name: options?.stepName,
      summary,
      result: errorMessage,
      error_code: errorCode,
      error_message: errorMessage,
      metadata: options?.metadata,
    });
  }

  // ========================================================================
  // Internal
  // ========================================================================

  private log(
    overrides: Partial<EventLogEntry> & {
      event_type: EventLogEntry['event_type'];
      event_status: EventLogEntry['event_status'];
      summary: string;
      result: string;
    }
  ): boolean {
    const event: EventLogEntry = {
      correlation_id: this.correlationId,
      trace_id: this.traceId,
      account_id: this.config.accountId,
      batch_id: this.config.batchId,
      application_id: this.config.applicationId,
      target_system: this.config.targetSystem,
      originating_system: this.config.originatingSystem,
      process_name: this.config.processName,
      identifiers: (this.config.identifiers ?? {}) as EventIdentifiers,
      event_timestamp: new Date().toISOString(),
      ...overrides,
    };

    return this.config.logger.log(event);
  }
}
