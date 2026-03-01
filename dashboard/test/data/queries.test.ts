import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiGet } = vi.hoisted(() => {
  const mockApiGet = vi.fn();
  return { mockApiGet };
});

vi.mock('@/lib/api-client', () => ({
  apiGet: mockApiGet,
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

import { getTraces, getDashboardStats, getTraceDetail } from '@/data/queries';

describe('getTraces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated traces with default page/pageSize', async () => {
    mockApiGet.mockResolvedValue({
      traces: [
        { traceId: 't-1', processName: 'proc', accountId: null, eventCount: 2, hasErrors: false, latestStatus: 'SUCCESS', startTime: '2025-01-01', endTime: '2025-01-01', durationMs: 500 },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      hasMore: false,
    });

    const result = await getTraces({});

    expect(mockApiGet).toHaveBeenCalledWith('/v1/traces', { page: '1', pageSize: '25' });
    expect(result.traces).toEqual([
      { traceId: 't-1', processName: 'proc', accountId: null, eventCount: 2, hasErrors: false, latestStatus: 'SUCCESS', firstEventAt: '2025-01-01', lastEventAt: '2025-01-01', totalDurationMs: 500 },
    ]);
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.totalPages).toBe(1);
  });

  it('passes filter params to the API', async () => {
    mockApiGet.mockResolvedValue({
      traces: [],
      totalCount: 0,
      page: 2,
      pageSize: 10,
      hasMore: false,
    });

    await getTraces({
      processName: 'order',
      accountId: 'acc-1',
      eventStatus: 'SUCCESS',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      page: 2,
      pageSize: 10,
    });

    expect(mockApiGet).toHaveBeenCalledWith('/v1/traces', {
      page: '2',
      pageSize: '10',
      processName: 'order',
      accountId: 'acc-1',
      eventStatus: 'SUCCESS',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
  });

  it('returns empty traces and zero totalPages for no results', async () => {
    mockApiGet.mockResolvedValue({
      traces: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      hasMore: false,
    });

    const result = await getTraces({});

    expect(result.traces).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('calculates totalPages correctly', async () => {
    mockApiGet.mockResolvedValue({
      traces: [],
      totalCount: 51,
      page: 1,
      pageSize: 25,
      hasMore: true,
    });

    const result = await getTraces({ pageSize: 25 });

    expect(result.totalPages).toBe(3); // ceil(51/25)
  });

  it('maps nullable processName to "Unknown"', async () => {
    mockApiGet.mockResolvedValue({
      traces: [
        { traceId: 't-1', processName: null, accountId: null, eventCount: 1, hasErrors: false, latestStatus: 'SUCCESS', startTime: '2025-01-01', endTime: '2025-01-01', durationMs: null },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      hasMore: false,
    });

    const result = await getTraces({});

    expect(result.traces[0].processName).toBe('Unknown');
  });
});

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated dashboard stats with derived totalSystems', async () => {
    mockApiGet.mockResolvedValue({
      totalTraces: 100,
      totalAccounts: 10,
      totalEvents: 200,
      successRate: 90,
      systemNames: ['SystemA', 'SystemB', 'SystemC'],
    });

    const result = await getDashboardStats();

    expect(mockApiGet).toHaveBeenCalledWith('/v1/dashboard/stats');
    expect(result.totalTraces).toBe(100);
    expect(result.totalAccounts).toBe(10);
    expect(result.totalSystems).toBe(3);
    expect(result.successRate).toBe(90);
    expect(result.totalEvents).toBe(200);
    expect(result.systemNames).toHaveLength(3);
  });

  it('returns 0 totalSystems when no systems', async () => {
    mockApiGet.mockResolvedValue({
      totalTraces: 0,
      totalAccounts: 0,
      totalEvents: 0,
      successRate: 0,
      systemNames: [],
    });

    const result = await getDashboardStats();

    expect(result.totalSystems).toBe(0);
    expect(result.systemNames).toEqual([]);
  });
});

describe('getTraceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for 404 response', async () => {
    const err = new Error('API 404: Not Found');
    (err as any).status = 404;
    err.name = 'ApiError';
    mockApiGet.mockRejectedValue(err);

    const result = await getTraceDetail('nonexistent');

    expect(result).toBeNull();
  });

  it('maps API response to TraceDetail', async () => {
    mockApiGet.mockResolvedValue({
      traceId: 'trace-1',
      events: [
        {
          eventLogId: 1, executionId: 'exec-1', correlationId: 'corr-1',
          accountId: 'acc-1', traceId: 'trace-1', spanId: null, parentSpanId: null,
          batchId: null, applicationId: 'app-1', targetSystem: 'SystemA',
          originatingSystem: 'Origin', processName: 'test-process',
          stepSequence: 1, stepName: 'step-1', eventType: 'API_CALL',
          eventStatus: 'SUCCESS', identifiers: null, summary: 'test', result: 'OK',
          metadata: null, eventTimestamp: '2025-01-01T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z', executionTimeMs: 100,
          endpoint: null, httpStatusCode: null, httpMethod: null,
          errorCode: null, errorMessage: null, requestPayload: null,
          responsePayload: null,
        },
        {
          eventLogId: 2, executionId: 'exec-2', correlationId: 'corr-1',
          accountId: 'acc-1', traceId: 'trace-1', spanId: null, parentSpanId: null,
          batchId: null, applicationId: 'app-1', targetSystem: 'SystemB',
          originatingSystem: 'Origin', processName: 'test-process',
          stepSequence: 2, stepName: 'step-2', eventType: 'API_CALL',
          eventStatus: 'FAILURE', identifiers: null, summary: 'test fail', result: 'ERR',
          metadata: null, eventTimestamp: '2025-01-01T00:00:01.000Z',
          createdAt: '2025-01-01T00:00:01.000Z', executionTimeMs: 200,
          endpoint: null, httpStatusCode: null, httpMethod: null,
          errorCode: null, errorMessage: null, requestPayload: null,
          responsePayload: null,
        },
      ],
      systemsInvolved: ['SystemA', 'SystemB', 'Origin'],
      totalDurationMs: 1000,
      totalCount: 2,
      page: 1,
      pageSize: 500,
      hasMore: false,
      statusCounts: { success: 1, failure: 1, inProgress: 0, skipped: 0, warning: 0 },
      processName: 'test-process',
      accountId: 'acc-1',
      startTime: '2025-01-01T00:00:00.000Z',
      endTime: '2025-01-01T00:00:01.000Z',
    });

    const result = await getTraceDetail('trace-1');

    expect(mockApiGet).toHaveBeenCalledWith('/v1/events/trace/trace-1', { pageSize: '500' });
    expect(result).not.toBeNull();
    expect(result!.events).toHaveLength(2);
    expect(result!.events[0].eventLogId).toBe(1);
    expect(result!.systemsInvolved).toContain('SystemA');
    expect(result!.systemsInvolved).toContain('SystemB');
    expect(result!.statusCounts).toEqual({ SUCCESS: 1, FAILURE: 1 });
    expect(result!.totalDurationMs).toBe(1000);
    expect(result!.processName).toBe('test-process');
    expect(result!.accountId).toBe('acc-1');
  });

  it('returns null when API returns empty events', async () => {
    mockApiGet.mockResolvedValue({
      traceId: 'trace-1',
      events: [],
      systemsInvolved: [],
      totalDurationMs: null,
      totalCount: 0,
      page: 1,
      pageSize: 500,
      hasMore: false,
      statusCounts: { success: 0, failure: 0, inProgress: 0, skipped: 0, warning: 0 },
      processName: null,
      accountId: null,
      startTime: null,
      endTime: null,
    });

    const result = await getTraceDetail('trace-1');

    expect(result).toBeNull();
  });

  it('provides defaults for nullable processName and timestamps', async () => {
    mockApiGet.mockResolvedValue({
      traceId: 'trace-1',
      events: [
        {
          eventLogId: 1, executionId: 'e', correlationId: 'c',
          accountId: null, traceId: 'trace-1', spanId: null, parentSpanId: null,
          batchId: null, applicationId: 'a', targetSystem: 'S',
          originatingSystem: 'O', processName: 'p',
          stepSequence: 1, stepName: 's', eventType: 'STEP',
          eventStatus: 'SUCCESS', identifiers: null, summary: '', result: '',
          metadata: null, eventTimestamp: '2025-01-01T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z', executionTimeMs: null,
          endpoint: null, httpStatusCode: null, httpMethod: null,
          errorCode: null, errorMessage: null, requestPayload: null,
          responsePayload: null,
        },
      ],
      systemsInvolved: ['S', 'O'],
      totalDurationMs: null,
      totalCount: 1,
      page: 1,
      pageSize: 500,
      hasMore: false,
      statusCounts: { success: 1, failure: 0, inProgress: 0, skipped: 0, warning: 0 },
      processName: null,
      accountId: null,
      startTime: null,
      endTime: null,
    });

    const result = await getTraceDetail('trace-1');

    expect(result!.processName).toBe('Unknown');
    expect(result!.startTime).toBeDefined();
    expect(result!.endTime).toBeDefined();
  });
});
