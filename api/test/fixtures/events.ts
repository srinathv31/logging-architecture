import type { EventLogEntry } from '../../src/types/api';

/**
 * Creates a valid EventLogEntry for testing
 */
export function createEventFixture(overrides: Partial<EventLogEntry> = {}): EventLogEntry {
  return {
    correlationId: 'test-correlation-id',
    accountId: 'test-account-id',
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
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
    eventTimestamp: new Date().toISOString(),
    executionTimeMs: 100,
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
      correlationId: `${baseOverrides.correlationId ?? 'batch-correlation'}-${i}`,
      spanId: `span-${i}`,
      stepSequence: i + 1,
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
