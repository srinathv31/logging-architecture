import type { TraceEvent, TraceSummary, TraceListResult, TraceDetail } from '@/data/queries';

export function makeTraceEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    eventLogId: 1,
    executionId: 'exec-1',
    correlationId: 'corr-1',
    accountId: null,
    traceId: 'trace-1',
    spanId: null,
    parentSpanId: null,
    batchId: null,
    applicationId: 'app-1',
    targetSystem: 'SystemA',
    originatingSystem: 'origin',
    processName: 'test-process',
    stepSequence: null,
    stepName: null,
    eventType: 'API_CALL',
    eventStatus: 'SUCCESS',
    identifiers: null,
    summary: 'test event',
    result: 'OK',
    metadata: null,
    eventTimestamp: '2025-01-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    executionTimeMs: null,
    endpoint: null,
    httpStatusCode: null,
    httpMethod: null,
    errorCode: null,
    errorMessage: null,
    requestPayload: null,
    responsePayload: null,
    ...overrides,
  };
}

export function makeTraceSummary(overrides: Partial<TraceSummary> = {}): TraceSummary {
  return {
    traceId: 'trace-1',
    processName: 'test-process',
    accountId: null,
    batchId: null,
    eventCount: 3,
    hasErrors: false,
    latestStatus: 'SUCCESS',
    firstEventAt: '2025-01-01T00:00:00.000Z',
    lastEventAt: '2025-01-01T00:01:00.000Z',
    totalDurationMs: 60000,
    ...overrides,
  };
}

export function makeTraceListResult(overrides: Partial<TraceListResult> = {}): TraceListResult {
  return {
    traces: [makeTraceSummary()],
    totalCount: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    ...overrides,
  };
}

export function makeTraceDetail(overrides: Partial<TraceDetail> = {}): TraceDetail {
  return {
    events: [makeTraceEvent()],
    systemsInvolved: ['SystemA', 'origin'],
    totalDurationMs: 1000,
    statusCounts: { SUCCESS: 1 },
    processName: 'test-process',
    accountId: null,
    startTime: '2025-01-01T00:00:00.000Z',
    endTime: '2025-01-01T00:00:01.000Z',
    ...overrides,
  };
}
