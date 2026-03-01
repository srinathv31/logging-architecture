// ============================================================================
// FLUENT EVENT LOG ENTRY BUILDER
// ============================================================================

import {
  EventLogEntry,
  EventType,
  EventStatus,
  HttpMethod,
  EventIdentifiers,
} from '../models/types';
import { validateEvent } from './helpers';

/**
 * Fluent builder for constructing EventLogEntry objects.
 *
 * @example
 * ```typescript
 * const event = eventBuilder()
 *   .correlationId('corr-123')
 *   .traceId('abc123')
 *   .applicationId('my-app')
 *   .targetSystem('vendor-api')
 *   .originatingSystem('my-service')
 *   .processName('CreateAccount')
 *   .eventType(EventType.STEP)
 *   .eventStatus(EventStatus.SUCCESS)
 *   .stepSequence(1)
 *   .stepName('Verify Identity')
 *   .summary('Verified identity')
 *   .result('PASS')
 *   .build();
 * ```
 */
export class EventLogEntryBuilder {
  private entry: Partial<EventLogEntry> = {
    identifiers: {},
  };

  // --- Core identifiers ---

  correlationId(value: string): this {
    this.entry.correlation_id = value;
    return this;
  }

  traceId(value: string): this {
    this.entry.trace_id = value;
    return this;
  }

  spanId(value: string): this {
    this.entry.span_id = value;
    return this;
  }

  parentSpanId(value: string): this {
    this.entry.parent_span_id = value;
    return this;
  }

  spanLinks(value: string[]): this {
    this.entry.span_links = value;
    return this;
  }

  batchId(value: string): this {
    this.entry.batch_id = value;
    return this;
  }

  accountId(value: string | null): this {
    this.entry.account_id = value;
    return this;
  }

  // --- System context ---

  applicationId(value: string): this {
    this.entry.application_id = value;
    return this;
  }

  targetSystem(value: string): this {
    this.entry.target_system = value;
    return this;
  }

  originatingSystem(value: string): this {
    this.entry.originating_system = value;
    return this;
  }

  // --- Process details ---

  processName(value: string): this {
    this.entry.process_name = value;
    return this;
  }

  stepSequence(value: number): this {
    this.entry.step_sequence = value;
    return this;
  }

  stepName(value: string): this {
    this.entry.step_name = value;
    return this;
  }

  eventType(value: EventType): this {
    this.entry.event_type = value;
    return this;
  }

  eventStatus(value: EventStatus): this {
    this.entry.event_status = value;
    return this;
  }

  // --- Business data ---

  identifiers(value: EventIdentifiers): this {
    this.entry.identifiers = { ...this.entry.identifiers, ...value };
    return this;
  }

  identifier(key: string, value: string): this {
    this.entry.identifiers = { ...this.entry.identifiers, [key]: value };
    return this;
  }

  summary(value: string): this {
    this.entry.summary = value;
    return this;
  }

  result(value: string): this {
    this.entry.result = value;
    return this;
  }

  metadata(value: Record<string, unknown>): this {
    this.entry.metadata = { ...this.entry.metadata, ...value };
    return this;
  }

  // --- Timing ---

  eventTimestamp(value: string | Date): this {
    this.entry.event_timestamp = value instanceof Date ? value.toISOString() : value;
    return this;
  }

  executionTimeMs(value: number): this {
    this.entry.execution_time_ms = value;
    return this;
  }

  // --- HTTP details ---

  endpoint(value: string): this {
    this.entry.endpoint = value;
    return this;
  }

  httpMethod(value: HttpMethod): this {
    this.entry.http_method = value;
    return this;
  }

  httpStatusCode(value: number): this {
    this.entry.http_status_code = value;
    return this;
  }

  // --- Error tracking ---

  errorCode(value: string): this {
    this.entry.error_code = value;
    return this;
  }

  errorMessage(value: string): this {
    this.entry.error_message = value;
    return this;
  }

  // --- Payloads ---

  requestPayload(value: string): this {
    this.entry.request_payload = value;
    return this;
  }

  responsePayload(value: string): this {
    this.entry.response_payload = value;
    return this;
  }

  // --- Deduplication ---

  idempotencyKey(value: string): this {
    this.entry.idempotency_key = value;
    return this;
  }

  // --- Copy ---

  /**
   * Create a new builder pre-populated from an existing EventLogEntry.
   * Useful for creating variations of an existing event.
   */
  static fromEntry(entry: EventLogEntry): EventLogEntryBuilder {
    const builder = new EventLogEntryBuilder();
    builder.entry = {
      ...entry,
      identifiers: { ...entry.identifiers },
      span_links: entry.span_links ? [...entry.span_links] : undefined,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
    };
    return builder;
  }

  // --- Build ---

  /**
   * Build the EventLogEntry. Auto-sets event_timestamp if not provided.
   * Validates required fields and throws if any are missing.
   */
  build(): EventLogEntry {
    if (!this.entry.event_timestamp) {
      this.entry.event_timestamp = new Date().toISOString();
    }
    if (!this.entry.identifiers) {
      this.entry.identifiers = {};
    }

    const errors = validateEvent(this.entry);
    if (errors.length > 0) {
      throw new Error(`EventLogEntry validation failed: ${errors.join(', ')}`);
    }

    return this.entry as EventLogEntry;
  }
}

/**
 * Factory function to create a new EventLogEntryBuilder
 */
export function eventBuilder(): EventLogEntryBuilder {
  return new EventLogEntryBuilder();
}
