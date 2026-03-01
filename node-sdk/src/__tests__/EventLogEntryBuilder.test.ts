import { describe, it, expect } from 'vitest';
import { EventLogEntryBuilder, eventBuilder } from '../utils/EventLogEntryBuilder';
import { EventType, EventStatus, HttpMethod } from '../models/types';

describe('EventLogEntryBuilder', () => {
  const validBuilder = () =>
    eventBuilder()
      .correlationId('corr-1')
      .traceId('trace-1')
      .applicationId('app')
      .targetSystem('target')
      .originatingSystem('origin')
      .processName('TestProcess')
      .eventType(EventType.STEP)
      .eventStatus(EventStatus.SUCCESS)
      .summary('Test summary')
      .result('OK');

  it('builds a valid EventLogEntry', () => {
    const event = validBuilder().build();
    expect(event.correlation_id).toBe('corr-1');
    expect(event.trace_id).toBe('trace-1');
    expect(event.event_type).toBe(EventType.STEP);
    expect(event.event_timestamp).toBeTruthy();
  });

  it('throws on missing required fields', () => {
    expect(() => eventBuilder().build()).toThrow('validation failed');
  });

  it('sets all optional fields', () => {
    const event = validBuilder()
      .spanId('span-1')
      .parentSpanId('parent-1')
      .spanLinks(['link-1'])
      .batchId('batch-1')
      .accountId('acct-1')
      .stepSequence(3)
      .stepName('Verify')
      .identifier('customer_id', 'c123')
      .identifiers({ employee_id: 'e456' })
      .metadata({ key: 'val' })
      .eventTimestamp('2024-01-01T00:00:00Z')
      .executionTimeMs(500)
      .endpoint('/api/v1/test')
      .httpMethod(HttpMethod.POST)
      .httpStatusCode(200)
      .errorCode('E001')
      .errorMessage('Something')
      .requestPayload('{"a":1}')
      .responsePayload('{"b":2}')
      .idempotencyKey('idem-1')
      .build();

    expect(event.span_id).toBe('span-1');
    expect(event.parent_span_id).toBe('parent-1');
    expect(event.span_links).toEqual(['link-1']);
    expect(event.batch_id).toBe('batch-1');
    expect(event.account_id).toBe('acct-1');
    expect(event.step_sequence).toBe(3);
    expect(event.step_name).toBe('Verify');
    expect(event.identifiers.customer_id).toBe('c123');
    expect(event.identifiers.employee_id).toBe('e456');
    expect(event.metadata).toEqual({ key: 'val' });
    expect(event.event_timestamp).toBe('2024-01-01T00:00:00Z');
    expect(event.execution_time_ms).toBe(500);
    expect(event.endpoint).toBe('/api/v1/test');
    expect(event.http_method).toBe(HttpMethod.POST);
    expect(event.http_status_code).toBe(200);
    expect(event.error_code).toBe('E001');
    expect(event.error_message).toBe('Something');
    expect(event.request_payload).toBe('{"a":1}');
    expect(event.response_payload).toBe('{"b":2}');
    expect(event.idempotency_key).toBe('idem-1');
  });

  it('accepts Date for eventTimestamp', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const event = validBuilder().eventTimestamp(date).build();
    expect(event.event_timestamp).toBe('2024-06-15T12:00:00.000Z');
  });

  it('auto-sets event_timestamp if not provided', () => {
    const before = new Date().toISOString();
    const event = validBuilder().build();
    const after = new Date().toISOString();
    expect(event.event_timestamp >= before).toBe(true);
    expect(event.event_timestamp <= after).toBe(true);
  });
});

describe('EventLogEntryBuilder.fromEntry', () => {
  it('copies all fields from an existing entry', () => {
    const original = eventBuilder()
      .correlationId('corr-1')
      .traceId('trace-1')
      .applicationId('app')
      .targetSystem('target')
      .originatingSystem('origin')
      .processName('TestProcess')
      .eventType(EventType.STEP)
      .eventStatus(EventStatus.SUCCESS)
      .stepSequence(1)
      .stepName('Step1')
      .summary('Original summary')
      .result('OK')
      .identifier('customer_id', 'c123')
      .metadata({ key: 'val' })
      .spanId('span-1')
      .spanLinks(['link-1'])
      .build();

    const copy = EventLogEntryBuilder.fromEntry(original)
      .summary('Modified summary')
      .stepSequence(2)
      .build();

    // Modified fields
    expect(copy.summary).toBe('Modified summary');
    expect(copy.step_sequence).toBe(2);

    // Preserved fields
    expect(copy.correlation_id).toBe('corr-1');
    expect(copy.trace_id).toBe('trace-1');
    expect(copy.application_id).toBe('app');
    expect(copy.step_name).toBe('Step1');
    expect(copy.span_id).toBe('span-1');
    expect(copy.identifiers.customer_id).toBe('c123');
    expect(copy.metadata).toEqual({ key: 'val' });
  });

  it('creates independent copies (no shared references)', () => {
    const original = eventBuilder()
      .correlationId('corr-1')
      .traceId('trace-1')
      .applicationId('app')
      .targetSystem('target')
      .originatingSystem('origin')
      .processName('TestProcess')
      .eventType(EventType.STEP)
      .eventStatus(EventStatus.SUCCESS)
      .summary('Test')
      .result('OK')
      .identifier('customer_id', 'c123')
      .metadata({ key: 'val' })
      .build();

    const copy = EventLogEntryBuilder.fromEntry(original)
      .identifier('new_id', 'new_val')
      .build();

    // Original should not be affected
    expect(original.identifiers.new_id).toBeUndefined();
    expect(copy.identifiers.new_id).toBe('new_val');
  });
});

describe('eventBuilder factory', () => {
  it('returns a new EventLogEntryBuilder', () => {
    expect(eventBuilder()).toBeInstanceOf(EventLogEntryBuilder);
  });
});
