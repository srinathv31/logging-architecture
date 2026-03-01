import { describe, it, expect } from 'vitest';
import {
  createCorrelationId,
  createBatchId,
  createTraceId,
  createSpanId,
  createProcessStartEvent,
  createStepEvent,
  createProcessEndEvent,
  createErrorEvent,
  generateSummary,
  maskLast4,
  validateEvent,
  truncatePayload,
} from '../utils/helpers';
import { EventType, EventStatus } from '../models/types';

// ============================================================================
// ID Generation
// ============================================================================

describe('createCorrelationId', () => {
  it('generates a unique ID with default prefix', () => {
    const id = createCorrelationId();
    expect(id).toMatch(/^corr-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('uses custom prefix', () => {
    const id = createCorrelationId('acct');
    expect(id.startsWith('acct-')).toBe(true);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createCorrelationId()));
    expect(ids.size).toBe(100);
  });
});

describe('createBatchId', () => {
  it('generates a batch ID with date and source', () => {
    const id = createBatchId('csv-import');
    expect(id).toMatch(/^batch-\d{8}-csv-import-[a-z0-9]+$/);
  });

  it('uses default source', () => {
    const id = createBatchId();
    expect(id).toMatch(/^batch-\d{8}-batch-[a-z0-9]+$/);
  });
});

describe('createTraceId', () => {
  it('generates 32 hex characters', () => {
    const id = createTraceId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('createSpanId', () => {
  it('generates 16 hex characters', () => {
    const id = createSpanId();
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });
});

// ============================================================================
// EventStatus enum
// ============================================================================

describe('EventStatus', () => {
  it('includes WARNING value', () => {
    expect(EventStatus.WARNING).toBe('WARNING');
  });
});

// ============================================================================
// Event Builders
// ============================================================================

const baseParams = {
  correlation_id: 'corr-123',
  trace_id: 'trace-abc',
  application_id: 'test-app',
  target_system: 'target',
  originating_system: 'origin',
  process_name: 'TestProcess',
  summary: 'Test summary',
  result: 'OK',
};

describe('createProcessStartEvent', () => {
  it('creates a PROCESS_START event', () => {
    const event = createProcessStartEvent(baseParams);
    expect(event.event_type).toBe(EventType.PROCESS_START);
    expect(event.event_status).toBe(EventStatus.IN_PROGRESS);
    expect(event.step_sequence).toBe(0);
    expect(event.event_timestamp).toBeTruthy();
    expect(event.identifiers).toEqual({});
  });

  it('preserves custom identifiers', () => {
    const event = createProcessStartEvent({
      ...baseParams,
      identifiers: { customer_id: 'c123' },
    });
    expect(event.identifiers.customer_id).toBe('c123');
  });
});

describe('createStepEvent', () => {
  it('creates a STEP event', () => {
    const event = createStepEvent({
      ...baseParams,
      event_status: EventStatus.SUCCESS,
      identifiers: {},
      step_sequence: 1,
      step_name: 'Step1',
    });
    expect(event.event_type).toBe(EventType.STEP);
    expect(event.step_sequence).toBe(1);
  });
});

describe('createProcessEndEvent', () => {
  it('creates a PROCESS_END event', () => {
    const event = createProcessEndEvent({
      ...baseParams,
      event_status: EventStatus.SUCCESS,
      identifiers: {},
      execution_time_ms: 1500,
    });
    expect(event.event_type).toBe(EventType.PROCESS_END);
    expect(event.execution_time_ms).toBe(1500);
  });
});

describe('createErrorEvent', () => {
  it('creates an ERROR event with FAILURE status', () => {
    const event = createErrorEvent({
      ...baseParams,
      identifiers: {},
      error_code: 'E001',
      error_message: 'Something broke',
    });
    expect(event.event_type).toBe(EventType.ERROR);
    expect(event.event_status).toBe(EventStatus.FAILURE);
    expect(event.error_code).toBe('E001');
  });
});

// ============================================================================
// Summary & Masking
// ============================================================================

describe('generateSummary', () => {
  it('generates a basic summary', () => {
    expect(generateSummary({ action: 'Verified', outcome: 'passed' }))
      .toBe('Verified - passed');
  });

  it('includes target and details', () => {
    expect(
      generateSummary({
        action: 'Checked',
        target: 'identity',
        outcome: 'approved',
        details: 'score 95',
      })
    ).toBe('Checked identity - approved (score 95)');
  });
});

describe('maskLast4', () => {
  it('masks a long value', () => {
    expect(maskLast4('1234567890')).toBe('***7890');
  });

  it('masks a short value', () => {
    expect(maskLast4('ab')).toBe('****');
  });

  it('handles empty string', () => {
    expect(maskLast4('')).toBe('****');
  });
});

// ============================================================================
// Validation
// ============================================================================

describe('validateEvent', () => {
  it('returns no errors for a valid event', () => {
    const errors = validateEvent({
      correlation_id: 'c',
      trace_id: 't',
      application_id: 'a',
      target_system: 'ts',
      originating_system: 'os',
      process_name: 'p',
      event_type: EventType.STEP,
      event_status: EventStatus.SUCCESS,
      summary: 's',
      result: 'r',
    });
    expect(errors).toEqual([]);
  });

  it('returns errors for missing required fields', () => {
    const errors = validateEvent({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('correlation_id is required');
    expect(errors).toContain('trace_id is required');
  });
});

// ============================================================================
// Payload Truncation
// ============================================================================

describe('truncatePayload', () => {
  it('returns undefined for undefined input', () => {
    expect(truncatePayload(undefined, 100)).toBeUndefined();
  });

  it('returns short payloads unchanged', () => {
    expect(truncatePayload('hello', 100)).toBe('hello');
  });

  it('truncates oversized payloads with suffix', () => {
    const payload = 'A'.repeat(200);
    const result = truncatePayload(payload, 100);
    expect(result!.endsWith('[TRUNCATED]')).toBe(true);
    // The byte length of the result should be <= maxBytes
    const byteLen = new TextEncoder().encode(result!).length;
    expect(byteLen).toBeLessThanOrEqual(100);
  });

  it('handles multi-byte characters correctly', () => {
    const payload = '\u{1F600}'.repeat(50); // emoji, 4 bytes each
    const result = truncatePayload(payload, 50);
    expect(result!.endsWith('[TRUNCATED]')).toBe(true);
    const byteLen = new TextEncoder().encode(result!).length;
    expect(byteLen).toBeLessThanOrEqual(50);
  });
});
