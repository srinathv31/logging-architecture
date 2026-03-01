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
import { eventLogContext } from '../context/EventLogContext';

/**
 * One-shot event options that can be applied to any log method.
 * These are per-event overrides (not persisted across events).
 */
export interface EventOptions {
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
  idempotencyKey?: string;
  targetSystem?: string;
  result?: string;
}

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

  // Span tracking
  private _rootSpanId: string | undefined;
  private _lastStepSpanId: string | undefined;

  // Persistent state (mutable after construction)
  private _identifiers: Record<string, string>;
  private _metadata: Record<string, unknown> = {};

  // Per-process overrides
  private _applicationId: string;
  private _targetSystem: string;
  private _originatingSystem: string;

  constructor(config: ProcessLoggerConfig) {
    this.config = config;

    // Resolve IDs: explicit config > async context > auto-generate
    const ctx = eventLogContext.get();
    this.correlationId = config.correlationId ?? ctx?.correlationId ?? createCorrelationId();
    this.traceId = config.traceId ?? ctx?.traceId ?? createTraceId();
    this._identifiers = { ...(config.identifiers ?? {}) };
    this._applicationId = config.applicationId;
    this._targetSystem = config.targetSystem;
    this._originatingSystem = config.originatingSystem;
  }

  // ========================================================================
  // Span Tracking
  // ========================================================================

  /** Get the span ID from the first event logged (logStart) */
  getRootSpanId(): string | undefined {
    return this._rootSpanId;
  }

  /** Get the span ID from the most recent logStep call */
  getLastStepSpanId(): string | undefined {
    return this._lastStepSpanId;
  }

  // ========================================================================
  // Persistent Mutators (apply to all subsequent events)
  // ========================================================================

  /** Add an identifier that persists across all subsequent events */
  addIdentifier(key: string, value: string): this {
    this._identifiers[key] = value;
    return this;
  }

  /** Add metadata that persists across all subsequent events */
  addMetadata(key: string, value: unknown): this {
    this._metadata[key] = value;
    return this;
  }

  // ========================================================================
  // Per-Process Overrides
  // ========================================================================

  /** Override the applicationId for this process logger */
  setApplicationId(id: string): this {
    this._applicationId = id;
    return this;
  }

  /** Override the default targetSystem for this process logger */
  setTargetSystem(system: string): this {
    this._targetSystem = system;
    return this;
  }

  /** Override the originatingSystem for this process logger */
  setOriginatingSystem(system: string): this {
    this._originatingSystem = system;
    return this;
  }

  // ========================================================================
  // Log Methods
  // ========================================================================

  /**
   * Log a PROCESS_START event (step_sequence = 0, status = IN_PROGRESS)
   */
  logStart(summary: string, options?: EventOptions & { result?: string }): boolean {
    const spanId = options?.spanId ?? createSpanId();
    this.trackSpan(spanId);

    return this.log({
      event_type: EventType.PROCESS_START,
      event_status: EventStatus.IN_PROGRESS,
      step_sequence: 0,
      summary,
      result: options?.result ?? summary,
      span_id: spanId,
      ...this.applyEventOptions(options),
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
    options?: EventOptions
  ): boolean {
    const spanId = options?.spanId ?? createSpanId();
    this._lastStepSpanId = spanId;

    return this.log({
      event_type: EventType.STEP,
      event_status: eventStatus,
      step_sequence: stepSequence,
      step_name: stepName,
      summary,
      result: options?.result ?? summary,
      span_id: spanId,
      ...this.applyEventOptions(options, { skipSpanId: true }),
    });
  }

  /**
   * Log a PROCESS_END event
   */
  logEnd(
    stepSequence: number,
    eventStatus: typeof EventStatus.SUCCESS | typeof EventStatus.FAILURE,
    summary: string,
    executionTimeMs: number,
    options?: EventOptions & { result?: string }
  ): boolean {
    const spanId = options?.spanId ?? createSpanId();
    this.trackSpan(spanId);

    return this.log({
      event_type: EventType.PROCESS_END,
      event_status: eventStatus,
      step_sequence: stepSequence,
      summary,
      result: options?.result ?? summary,
      execution_time_ms: executionTimeMs,
      span_id: spanId,
      ...this.applyEventOptions(options, { skipSpanId: true }),
    });
  }

  /**
   * Log an ERROR event (event_status = FAILURE)
   */
  logError(
    summary: string,
    errorCode: string,
    errorMessage: string,
    options?: EventOptions & {
      stepSequence?: number;
      stepName?: string;
    }
  ): boolean {
    const spanId = options?.spanId ?? createSpanId();
    this.trackSpan(spanId);

    return this.log({
      event_type: EventType.ERROR,
      event_status: EventStatus.FAILURE,
      step_sequence: options?.stepSequence,
      step_name: options?.stepName,
      summary,
      result: options?.result ?? errorMessage,
      error_code: errorCode,
      error_message: errorMessage,
      span_id: spanId,
      ...this.applyEventOptions(options, { skipSpanId: true }),
    });
  }

  // ========================================================================
  // Internal
  // ========================================================================

  private trackSpan(spanId: string): void {
    if (!this._rootSpanId) {
      this._rootSpanId = spanId;
    }
  }

  /** Extract EventOptions fields into partial EventLogEntry fields */
  private applyEventOptions(
    options?: EventOptions,
    flags?: { skipSpanId?: boolean }
  ): Partial<EventLogEntry> {
    if (!options) return {};
    const result: Partial<EventLogEntry> = {};
    if (!flags?.skipSpanId && options.spanId) result.span_id = options.spanId;
    if (options.parentSpanId) result.parent_span_id = options.parentSpanId;
    if (options.spanLinks) result.span_links = options.spanLinks;
    if (options.executionTimeMs !== undefined) result.execution_time_ms = options.executionTimeMs;
    if (options.endpoint) result.endpoint = options.endpoint;
    if (options.httpMethod) result.http_method = options.httpMethod;
    if (options.httpStatusCode !== undefined) result.http_status_code = options.httpStatusCode;
    if (options.requestPayload) result.request_payload = options.requestPayload;
    if (options.responsePayload) result.response_payload = options.responsePayload;
    if (options.errorCode) result.error_code = options.errorCode;
    if (options.errorMessage) result.error_message = options.errorMessage;
    if (options.idempotencyKey) result.idempotency_key = options.idempotencyKey;
    if (options.metadata) result.metadata = options.metadata;
    return result;
  }

  private log(
    overrides: Partial<EventLogEntry> & {
      event_type: EventLogEntry['event_type'];
      event_status: EventLogEntry['event_status'];
      summary: string;
      result: string;
    }
  ): boolean {
    // Merge persistent metadata with per-event metadata
    const mergedMetadata =
      Object.keys(this._metadata).length > 0 || overrides.metadata
        ? { ...this._metadata, ...overrides.metadata }
        : undefined;

    // Use per-event targetSystem override if provided via EventOptions
    const event: EventLogEntry = {
      correlation_id: this.correlationId,
      trace_id: this.traceId,
      account_id: this.config.accountId,
      batch_id: this.config.batchId,
      application_id: this._applicationId,
      target_system: this._targetSystem,
      originating_system: this._originatingSystem,
      process_name: this.config.processName,
      identifiers: { ...this._identifiers } as EventIdentifiers,
      event_timestamp: new Date().toISOString(),
      ...overrides,
      ...(mergedMetadata ? { metadata: mergedMetadata } : {}),
    };

    return this.config.logger.log(event);
  }
}
