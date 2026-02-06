import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable mock builder for Drizzle queries
function createChainableMock(resolvedValue: any) {
  const chain: any = {};
  const methods = [
    'select', 'selectDistinct', 'from', 'where', 'groupBy',
    'orderBy', 'offset', 'fetch', 'then',
  ];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Make the chain thenable so await works
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  return chain;
}

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    selectDistinct: vi.fn(),
  };
  return { mockDb };
});

vi.mock('@/db/drivers/mssql', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('@/db/schema/event-logs', () => ({
  eventLogs: {
    traceId: 'traceId',
    processName: 'processName',
    accountId: 'accountId',
    batchId: 'batchId',
    eventStatus: 'eventStatus',
    eventTimestamp: 'eventTimestamp',
    isDeleted: 'isDeleted',
    targetSystem: 'targetSystem',
    originatingSystem: 'originatingSystem',
    stepSequence: 'stepSequence',
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
  eq: (a: any, b: any) => ({ op: 'eq', a, b }),
  like: (a: any, b: any) => ({ op: 'like', a, b }),
  and: (...args: any[]) => ({ op: 'and', args }),
  gte: (a: any, b: any) => ({ op: 'gte', a, b }),
  lte: (a: any, b: any) => ({ op: 'lte', a, b }),
}));

import { getTraces, getDashboardStats, getTraceDetail } from '@/data/queries';

describe('getTraces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated traces with default page/pageSize', async () => {
    const tracesData = [
      { traceId: 't-1', processName: 'proc', accountId: null, batchId: null, eventCount: 2, hasErrors: false, latestStatus: 'SUCCESS', firstEventAt: '2025-01-01', lastEventAt: '2025-01-01', totalDurationMs: 500 },
    ];
    const countData = [{ totalCount: 1 }];

    const tracesChain = createChainableMock(tracesData);
    const countChain = createChainableMock(countData);

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1 ? tracesChain : countChain;
    });

    const result = await getTraces({});

    expect(result.traces).toEqual(tracesData);
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.totalPages).toBe(1);
  });

  it('applies filter conditions when provided', async () => {
    const tracesChain = createChainableMock([]);
    const countChain = createChainableMock([{ totalCount: 0 }]);

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1 ? tracesChain : countChain;
    });

    await getTraces({
      processName: 'order',
      batchId: 'batch-1',
      accountId: 'acc-1',
      eventStatus: 'SUCCESS',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      page: 2,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it('returns empty traces and zero totalPages for no results', async () => {
    const tracesChain = createChainableMock([]);
    const countChain = createChainableMock([{ totalCount: 0 }]);

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1 ? tracesChain : countChain;
    });

    const result = await getTraces({});

    expect(result.traces).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('calculates totalPages correctly', async () => {
    const tracesChain = createChainableMock([]);
    const countChain = createChainableMock([{ totalCount: 51 }]);

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1 ? tracesChain : countChain;
    });

    const result = await getTraces({ pageSize: 25 });

    expect(result.totalPages).toBe(3); // ceil(51/25)
  });

  it('handles missing count result', async () => {
    const tracesChain = createChainableMock([]);
    const countChain = createChainableMock([]);

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1 ? tracesChain : countChain;
    });

    const result = await getTraces({});

    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated dashboard stats', async () => {
    const statsData = [{ totalTraces: 100, totalAccounts: 10, totalEvents: 200, successCount: 180 }];
    const targetSystems = [{ system: 'SystemA' }, { system: 'SystemB' }];
    const originatingSystems = [{ system: 'SystemB' }, { system: 'SystemC' }];

    const statsChain = createChainableMock(statsData);
    const targetChain = createChainableMock(targetSystems);
    const originatingChain = createChainableMock(originatingSystems);

    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      return statsChain;
    });

    let distinctCallCount = 0;
    mockDb.selectDistinct.mockImplementation(() => {
      distinctCallCount++;
      return distinctCallCount === 1 ? targetChain : originatingChain;
    });

    const result = await getDashboardStats();

    expect(result.totalTraces).toBe(100);
    expect(result.totalAccounts).toBe(10);
    expect(result.totalSystems).toBe(3); // SystemA, SystemB, SystemC (Set dedup)
    expect(result.successRate).toBe(90); // (180/200)*100 rounded to 1 decimal = 90.0 -> 90
    expect(result.totalEvents).toBe(200);
    expect(result.systemNames).toHaveLength(3);
  });

  it('returns 0 success rate when no events', async () => {
    const statsData = [{ totalTraces: 0, totalAccounts: 0, totalEvents: 0, successCount: 0 }];

    const statsChain = createChainableMock(statsData);
    const emptyChain = createChainableMock([]);

    mockDb.select.mockReturnValue(statsChain);

    let distinctCallCount = 0;
    mockDb.selectDistinct.mockImplementation(() => {
      distinctCallCount++;
      return emptyChain;
    });

    const result = await getDashboardStats();

    expect(result.successRate).toBe(0);
    expect(result.totalSystems).toBe(0);
    expect(result.systemNames).toEqual([]);
  });

  it('filters falsy system names', async () => {
    const statsData = [{ totalTraces: 5, totalAccounts: 1, totalEvents: 10, successCount: 8 }];
    const targetSystems = [{ system: '' }, { system: null }, { system: 'RealSystem' }];
    const originatingSystems = [{ system: undefined }];

    const statsChain = createChainableMock(statsData);
    const targetChain = createChainableMock(targetSystems);
    const originatingChain = createChainableMock(originatingSystems);

    mockDb.select.mockReturnValue(statsChain);
    let distinctCallCount = 0;
    mockDb.selectDistinct.mockImplementation(() => {
      distinctCallCount++;
      return distinctCallCount === 1 ? targetChain : originatingChain;
    });

    const result = await getDashboardStats();

    expect(result.systemNames).toEqual(['RealSystem']);
    expect(result.totalSystems).toBe(1);
  });
});

describe('getTraceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for empty results', async () => {
    const chain = createChainableMock([]);
    mockDb.select.mockReturnValue(chain);

    const result = await getTraceDetail('nonexistent');

    expect(result).toBeNull();
  });

  it('maps rows to events and computes metadata', async () => {
    const rows = [
      {
        eventLogId: 1,
        executionId: 'exec-1',
        correlationId: 'corr-1',
        accountId: 'acc-1',
        traceId: 'trace-1',
        spanId: null,
        parentSpanId: null,
        batchId: null,
        applicationId: 'app-1',
        targetSystem: 'SystemA',
        originatingSystem: 'Origin',
        processName: 'test-process',
        stepSequence: 1,
        stepName: 'step-1',
        eventType: 'API_CALL',
        eventStatus: 'SUCCESS',
        identifiers: null,
        summary: 'test',
        result: 'OK',
        metadata: null,
        eventTimestamp: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        executionTimeMs: 100,
        endpoint: null,
        httpStatusCode: null,
        httpMethod: null,
        errorCode: null,
        errorMessage: null,
        requestPayload: null,
        responsePayload: null,
        isDeleted: false,
      },
      {
        eventLogId: 2,
        executionId: 'exec-2',
        correlationId: 'corr-1',
        accountId: 'acc-1',
        traceId: 'trace-1',
        spanId: null,
        parentSpanId: null,
        batchId: null,
        applicationId: 'app-1',
        targetSystem: 'SystemB',
        originatingSystem: 'Origin',
        processName: 'test-process',
        stepSequence: 2,
        stepName: 'step-2',
        eventType: 'API_CALL',
        eventStatus: 'FAILURE',
        identifiers: null,
        summary: 'test fail',
        result: 'ERR',
        metadata: null,
        eventTimestamp: new Date('2025-01-01T00:00:01.000Z'),
        createdAt: new Date('2025-01-01T00:00:01.000Z'),
        executionTimeMs: 200,
        endpoint: null,
        httpStatusCode: null,
        httpMethod: null,
        errorCode: null,
        errorMessage: null,
        requestPayload: null,
        responsePayload: null,
        isDeleted: false,
      },
    ];

    const chain = createChainableMock(rows);
    mockDb.select.mockReturnValue(chain);

    const result = await getTraceDetail('trace-1');

    expect(result).not.toBeNull();
    expect(result!.events).toHaveLength(2);
    expect(result!.events[0].eventLogId).toBe(1);
    expect(result!.events[0].eventTimestamp).toBe('2025-01-01T00:00:00.000Z');
    expect(result!.systemsInvolved).toContain('SystemA');
    expect(result!.systemsInvolved).toContain('SystemB');
    expect(result!.systemsInvolved).toContain('Origin');
    expect(result!.statusCounts).toEqual({ SUCCESS: 1, FAILURE: 1 });
    expect(result!.totalDurationMs).toBe(1000);
    expect(result!.processName).toBe('test-process');
    expect(result!.accountId).toBe('acc-1');
  });

  it('returns null duration when all events have same timestamp', async () => {
    const ts = new Date('2025-01-01T00:00:00.000Z');
    const rows = [
      {
        eventLogId: 1, executionId: 'e', correlationId: 'c', accountId: null,
        traceId: 't', spanId: null, parentSpanId: null, batchId: null,
        applicationId: 'a', targetSystem: 'S', originatingSystem: 'O',
        processName: 'p', stepSequence: 1, stepName: 's', eventType: 'STEP',
        eventStatus: 'SUCCESS', identifiers: null, summary: '', result: '',
        metadata: null, eventTimestamp: ts, createdAt: ts,
        executionTimeMs: null, endpoint: null, httpStatusCode: null,
        httpMethod: null, errorCode: null, errorMessage: null,
        requestPayload: null, responsePayload: null, isDeleted: false,
      },
    ];

    const chain = createChainableMock(rows);
    mockDb.select.mockReturnValue(chain);

    const result = await getTraceDetail('t');

    expect(result!.totalDurationMs).toBeNull();
  });
});
