import type { EventLogEntry } from '../../types/api';

/**
 * Creates a valid EventLogEntry for testing
 */
export function createEventFixture(overrides: Partial<EventLogEntry> = {}): EventLogEntry {
  return {
    correlation_id: 'test-correlation-id',
    account_id: 'test-account-id',
    trace_id: 'test-trace-id',
    span_id: 'test-span-id',
    application_id: 'test-app',
    target_system: 'test-target',
    originating_system: 'test-origin',
    process_name: 'test-process',
    step_sequence: 1,
    step_name: 'test-step',
    event_type: 'PROCESS_START',
    event_status: 'SUCCESS',
    identifiers: { test_id: 'test-123' },
    summary: 'Test event summary',
    result: 'Test result',
    metadata: { key: 'value' },
    event_timestamp: new Date().toISOString(),
    execution_time_ms: 100,
    ...overrides,
  };
}

/**
 * Creates a batch of EventLogEntry fixtures
 */
export function createEventBatchFixture(count: number, baseOverrides: Partial<EventLogEntry> = {}): EventLogEntry[] {
  return Array.from({ length: count }, (_, i) =>
    createEventFixture({
      ...baseOverrides,
      correlation_id: `${baseOverrides.correlation_id ?? 'batch-correlation'}-${i}`,
      span_id: `span-${i}`,
      step_sequence: i + 1,
    })
  );
}

/**
 * Creates a mock database event log record (returned from DB)
 * Includes eventLogId and updatedAt fields expected by the response schema
 */
export function createEventLogDbRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    eventLogId: 1,
    executionId: 'test-execution-id',
    correlationId: 'test-correlation-id',
    accountId: 'test-account-id',
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
    parentSpanId: null,
    spanLinks: null,
    batchId: null,
    applicationId: 'test-app',
    targetSystem: 'test-target',
    originatingSystem: 'test-origin',
    processName: 'test-process',
    stepSequence: 1,
    stepName: 'test-step',
    eventType: 'PROCESS_START',
    eventStatus: 'SUCCESS',
    identifiers: { test_id: 'test-123' },
    summary: 'Test event summary',
    result: 'Test result',
    metadata: { key: 'value' },
    eventTimestamp: now,
    executionTimeMs: 100,
    endpoint: null,
    httpMethod: null,
    httpStatusCode: null,
    errorCode: null,
    errorMessage: null,
    requestPayload: null,
    responsePayload: null,
    idempotencyKey: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
