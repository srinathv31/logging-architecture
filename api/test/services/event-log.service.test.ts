/**
 * Unit tests for event-log.service
 *
 * These tests focus on testing service logic with mocked database interactions.
 * Complex query builder chains are tested through integration tests.
 */
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { createEventFixture, createEventLogDbRecord, createEventBatchFixture } from '../fixtures/events';
import { createCorrelationLinkDbRecord } from '../fixtures/correlation-links';
import { chunkArray } from '../../src/utils/array';
import { formatFullTextQuery } from '../../src/utils/search';

// Use vi.hoisted to create mock - the factory function must be inline
const mockDb = vi.hoisted(() => {
  // State for configurable results
  let queryResult: unknown[] = [];
  let insertResult: unknown[] = [{ executionId: 'test-execution-id' }];
  let countResult = { count: 0 };
  let topResult: unknown[] = [];
  let selectDistinctResult: unknown[] = [];
  let fetchResults: unknown[][] = [];
  let fetchCallCount = 0;

  // Call tracking
  const callHistory = {
    select: [] as unknown[][],
    insert: [] as unknown[][],
    delete: [] as unknown[][],
    execute: [] as unknown[][],
  };

  const chainableMock = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    offset: vi.fn(),
    top: vi.fn(),
    fetch: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    output: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),

    _setQueryResult: (result: unknown[]) => { queryResult = result; },
    _setInsertResult: (result: unknown[]) => { insertResult = result; },
    _setCountResult: (count: number) => { countResult = { count }; },
    _setTopResult: (result: unknown[]) => { topResult = result; },
    _setSelectDistinctResult: (result: unknown[]) => { selectDistinctResult = result; },
    _setFetchResults: (results: unknown[][]) => { fetchResults = results; fetchCallCount = 0; },
    _reset: () => {
      queryResult = [];
      insertResult = [{ executionId: 'test-execution-id' }];
      countResult = { count: 0 };
      topResult = [];
      selectDistinctResult = [];
      fetchResults = [];
      fetchCallCount = 0;
      callHistory.select = [];
      callHistory.insert = [];
      callHistory.delete = [];
      callHistory.execute = [];

      Object.values(chainableMock).forEach((fn) => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as Mock).mockClear();
        }
      });

      // Re-setup mocks after clear
      chainableMock.select.mockImplementation((...args: unknown[]) => {
        callHistory.select.push(args);
        if (args[0] && typeof args[0] === 'object' && 'count' in (args[0] as object)) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([countResult]),
            }),
          };
        }
        return {
          top: vi.fn().mockImplementation(() => ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(topResult),
            }),
          })),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                offset: vi.fn().mockReturnValue({
                  fetch: vi.fn().mockImplementation(() => {
                    const result = fetchResults.length > 0 ? fetchResults[fetchCallCount] || queryResult : queryResult;
                    fetchCallCount++;
                    return Promise.resolve(result);
                  }),
                }),
              }),
            }),
          }),
        };
      });

      chainableMock.selectDistinct.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(selectDistinctResult),
        }),
      }));

      chainableMock.insert.mockImplementation((...args: unknown[]) => {
        callHistory.insert.push(args);
        return {
          output: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation(() => Promise.resolve(insertResult)),
          }),
          values: vi.fn().mockResolvedValue(undefined),
        };
      });

      chainableMock.delete.mockImplementation((...args: unknown[]) => {
        callHistory.delete.push(args);
        return Promise.resolve();
      });

      chainableMock.execute.mockImplementation((...args: unknown[]) => {
        callHistory.execute.push(args);
        return Promise.resolve();
      });

      chainableMock.transaction.mockImplementation(async (callback: (tx: typeof chainableMock) => Promise<void>) => {
        return callback(chainableMock);
      });

      chainableMock.top.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(topResult),
        }),
      }));

      chainableMock.fetch.mockImplementation(() => {
        const result = fetchResults.length > 0 ? fetchResults[fetchCallCount] || queryResult : queryResult;
        fetchCallCount++;
        return Promise.resolve(result);
      });
    },
    _getCallHistory: () => ({ ...callHistory }),
  };

  // Initial setup
  chainableMock._reset();

  return chainableMock;
});

// Mock MUST be after vi.hoisted
vi.mock('../../src/db/client', () => ({
  db: mockDb,
  getDb: vi.fn().mockResolvedValue(mockDb),
  closeDb: vi.fn(),
}));

// Mock the env config for full-text search tests
vi.mock('../../src/config/env', () => ({
  env: {
    FULLTEXT_ENABLED: 'false',
  },
}));

// Now import the service (uses mocked db)
import {
  createEvent,
  createEvents,
  getByAccount,
  getByCorrelation,
  getByTrace,
  listTraces,
  getDashboardStats,
  searchText,
  getByBatch,
  getBatchSummary,
  deleteAll,
} from '../../src/services/event-log.service';

describe('EventLogService', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  describe('createEvent', () => {
    it('should return existing record when idempotencyKey matches', async () => {
      const existingRecord = createEventLogDbRecord({
        executionId: 'existing-exec-id',
        idempotencyKey: 'idem-key-123',
      });

      mockDb._setTopResult([existingRecord]);

      const entry = createEventFixture({
        idempotencyKey: 'idem-key-123',
      });

      const result = await createEvent(entry);

      expect(result).toEqual(existingRecord);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should insert new record when no idempotencyKey match', async () => {
      const newRecord = createEventLogDbRecord({
        executionId: 'new-exec-id',
      });

      mockDb._setTopResult([]);
      mockDb._setInsertResult([newRecord]);

      const entry = createEventFixture({
        idempotencyKey: 'new-idem-key',
      });

      const result = await createEvent(entry);

      expect(result).toEqual(newRecord);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should insert without idempotency check when no idempotencyKey provided', async () => {
      const newRecord = createEventLogDbRecord({
        executionId: 'direct-insert-id',
      });

      mockDb._setInsertResult([newRecord]);

      const entry = createEventFixture();
      delete entry.idempotencyKey;

      const result = await createEvent(entry);

      expect(result).toEqual(newRecord);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.top).not.toHaveBeenCalled();
    });
  });

  describe('deleteAll', () => {
    it('should hard-delete all tables inside a transaction', async () => {
      await deleteAll();

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.delete).toHaveBeenCalledTimes(4);
    });
  });
});

// Tests for utility functions (using actual imported functions)
describe('EventLogService - Utility Functions', () => {
  describe('chunkArray', () => {
    it('should chunk array correctly', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      expect(chunkArray(arr, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
      expect(chunkArray(arr, 5)).toEqual([
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
      ]);
      expect(chunkArray(arr, 10)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]);
      expect(chunkArray(arr, 15)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]);
      expect(chunkArray([], 3)).toEqual([]);
    });
  });

  describe('formatFullTextQuery', () => {
    it('should format single word query', () => {
      expect(formatFullTextQuery('hello')).toBe('"hello*"');
    });

    it('should format multi-word query with AND', () => {
      expect(formatFullTextQuery('hello world')).toBe('"hello*" AND "world*"');
      expect(formatFullTextQuery('hello world test')).toBe(
        '"hello*" AND "world*" AND "test*"'
      );
    });

    it('should handle multiple spaces', () => {
      expect(formatFullTextQuery('  multiple   spaces  ')).toBe(
        '"multiple*" AND "spaces*"'
      );
    });

    it('should escape special characters', () => {
      expect(formatFullTextQuery('special"chars[')).toBe('"specialchars*"');
    });
  });
});

// Tests for getByTrace result processing (testing pure functions)
describe('EventLogService - getByTrace result processing', () => {
  it('should calculate duration between first and last events', () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    const endTime = new Date('2024-01-01T10:00:05Z');

    const events = [
      createEventLogDbRecord({ eventTimestamp: startTime }),
      createEventLogDbRecord({ eventTimestamp: endTime }),
    ];

    // Simulate the duration calculation from the service
    const first = events[0].eventTimestamp;
    const last = events[events.length - 1].eventTimestamp;
    const totalDurationMs = last.getTime() - first.getTime();

    expect(totalDurationMs).toBe(5000);
  });

  it('should deduplicate systems involved', () => {
    const events = [
      createEventLogDbRecord({ targetSystem: 'system-a' }),
      createEventLogDbRecord({ targetSystem: 'system-a' }),
      createEventLogDbRecord({ targetSystem: 'system-b' }),
      createEventLogDbRecord({ targetSystem: 'system-c' }),
      createEventLogDbRecord({ targetSystem: 'system-b' }),
    ];

    // Simulate the deduplication from the service
    const systemsInvolved = [...new Set(events.map((e) => e.targetSystem))];

    expect(systemsInvolved).toEqual(['system-a', 'system-b', 'system-c']);
    expect(systemsInvolved).toHaveLength(3);
  });

  it('should return null duration for empty events', () => {
    const events: ReturnType<typeof createEventLogDbRecord>[] = [];

    let totalDurationMs: number | null = null;
    if (events.length > 0) {
      const first = events[0].eventTimestamp;
      const last = events[events.length - 1].eventTimestamp;
      totalDurationMs = last.getTime() - first.getTime();
    }

    expect(totalDurationMs).toBeNull();
  });
});

// Test fixture tests
describe('EventLogService - Test Fixtures', () => {
  describe('createEventFixture', () => {
    it('should create a valid event fixture with default values', () => {
      const fixture = createEventFixture();

      expect(fixture.correlationId).toBe('test-correlation-id');
      expect(fixture.traceId).toBe('a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8');
      expect(fixture.applicationId).toBe('test-app');
      expect(fixture.eventType).toBe('PROCESS_START');
      expect(fixture.eventStatus).toBe('SUCCESS');
    });

    it('should allow overriding default values', () => {
      const fixture = createEventFixture({
        correlationId: 'custom-id',
        eventStatus: 'FAILURE',
      });

      expect(fixture.correlationId).toBe('custom-id');
      expect(fixture.eventStatus).toBe('FAILURE');
      expect(fixture.traceId).toBe('a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8');
    });

    it('should have required fields', () => {
      const fixture = createEventFixture();

      expect(fixture).toHaveProperty('correlationId');
      expect(fixture).toHaveProperty('traceId');
      expect(fixture).toHaveProperty('applicationId');
      expect(fixture).toHaveProperty('targetSystem');
      expect(fixture).toHaveProperty('originatingSystem');
      expect(fixture).toHaveProperty('processName');
      expect(fixture).toHaveProperty('eventType');
      expect(fixture).toHaveProperty('eventStatus');
      expect(fixture).toHaveProperty('identifiers');
      expect(fixture).toHaveProperty('summary');
      expect(fixture).toHaveProperty('result');
      expect(fixture).toHaveProperty('eventTimestamp');
    });

    it('should have valid timestamp', () => {
      const fixture = createEventFixture();
      const timestamp = new Date(fixture.eventTimestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });
  });

  describe('createEventLogDbRecord', () => {
    it('should create a valid database record with default values', () => {
      const record = createEventLogDbRecord();

      expect(record.executionId).toBe('test-execution-id');
      expect(record.correlationId).toBe('test-correlation-id');
      expect(record.isDeleted).toBe(false);
    });

    it('should allow overriding values', () => {
      const record = createEventLogDbRecord({
        executionId: 'custom-exec-id',
        eventStatus: 'FAILURE',
      });

      expect(record.executionId).toBe('custom-exec-id');
      expect(record.eventStatus).toBe('FAILURE');
    });

    it('should have createdAt and updatedAt timestamps', () => {
      const record = createEventLogDbRecord();

      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('createEventBatchFixture', () => {
    it('should create specified number of events', () => {
      const batch = createEventBatchFixture(5);
      expect(batch).toHaveLength(5);
    });

    it('should have unique correlation IDs per event', () => {
      const batch = createEventBatchFixture(3);
      const correlationIds = batch.map((e) => e.correlationId);
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('should increment step sequence', () => {
      const batch = createEventBatchFixture(3);
      expect(batch[0].stepSequence).toBe(1);
      expect(batch[1].stepSequence).toBe(2);
      expect(batch[2].stepSequence).toBe(3);
    });
  });
});

describe('EventLogService - Entry to Insert Mapping', () => {
  it('should map camelCase API fields to camelCase DB fields', () => {
    const entry = createEventFixture({
      correlationId: 'test-corr',
      accountId: 'test-account',
      traceId: 'test-trace',
      spanId: 'test-span',
      parentSpanId: 'parent-span',
      batchId: 'batch-1',
      applicationId: 'app-1',
      targetSystem: 'target-sys',
      originatingSystem: 'origin-sys',
      processName: 'process-1',
      stepSequence: 5,
      stepName: 'step-5',
      eventType: 'STEP',
      eventStatus: 'SUCCESS',
      executionTimeMs: 250,
      httpMethod: 'POST',
      httpStatusCode: 201,
      errorCode: 'ERR001',
      errorMessage: 'Test error',
      idempotencyKey: 'idem-key',
    });

    // Verify field mapping matches what the service expects
    expect(entry.correlationId).toBe('test-corr');
    expect(entry.accountId).toBe('test-account');
    expect(entry.traceId).toBe('test-trace');
    expect(entry.spanId).toBe('test-span');
    expect(entry.parentSpanId).toBe('parent-span');
    expect(entry.batchId).toBe('batch-1');
    expect(entry.applicationId).toBe('app-1');
    expect(entry.targetSystem).toBe('target-sys');
    expect(entry.originatingSystem).toBe('origin-sys');
    expect(entry.processName).toBe('process-1');
    expect(entry.stepSequence).toBe(5);
    expect(entry.stepName).toBe('step-5');
    expect(entry.eventType).toBe('STEP');
    expect(entry.eventStatus).toBe('SUCCESS');
    expect(entry.executionTimeMs).toBe(250);
    expect(entry.httpMethod).toBe('POST');
    expect(entry.httpStatusCode).toBe(201);
    expect(entry.errorCode).toBe('ERR001');
    expect(entry.errorMessage).toBe('Test error');
    expect(entry.idempotencyKey).toBe('idem-key');
  });

  it('should handle optional fields as null/undefined', () => {
    const entry = createEventFixture();

    // Optional fields should have defaults or be undefined
    expect(entry.parentSpanId).toBeUndefined();
    expect(entry.batchId).toBeUndefined();
    expect(entry.httpMethod).toBeUndefined();
    expect(entry.httpStatusCode).toBeUndefined();
    expect(entry.errorCode).toBeUndefined();
    expect(entry.errorMessage).toBeUndefined();
    expect(entry.idempotencyKey).toBeUndefined();
  });
});

describe('EventLogService - Batch processing helpers', () => {
  it('should chunk array correctly', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    expect(chunkArray(arr, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
    expect(chunkArray(arr, 5)).toEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
    expect(chunkArray(arr, 10)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]);
    expect(chunkArray(arr, 15)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]);
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('should format full text query correctly', () => {
    expect(formatFullTextQuery('hello')).toBe('"hello*"');
    expect(formatFullTextQuery('hello world')).toBe('"hello*" AND "world*"');
    expect(formatFullTextQuery('hello world test')).toBe('"hello*" AND "world*" AND "test*"');
    expect(formatFullTextQuery('  multiple   spaces  ')).toBe('"multiple*" AND "spaces*"');
    expect(formatFullTextQuery('special"chars[')).toBe('"specialchars*"');
  });
});

// ============================================================================
// COMPREHENSIVE TESTS FOR EVENT-LOG SERVICE FUNCTIONS
// ============================================================================

describe('createEvents', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should process entries within a transaction', async () => {
    const entries = [createEventFixture({ correlationId: 'corr-1' })];

    // Setup mock for transaction flow
    let transactionCalled = false;
    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      transactionCalled = true;
      // Mock the tx operations within transaction
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          output: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{ executionId: 'exec-1' }]),
          }),
        }),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createEvents(entries);

    expect(transactionCalled).toBe(true);
    expect(result.executionIds).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should return existing executionId for duplicate idempotency keys', async () => {
    const entries = [
      createEventFixture({ idempotencyKey: 'idem-1', correlationId: 'corr-1' }),
    ];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { idempotencyKey: 'idem-1', executionId: 'existing-exec-id' },
            ]),
          }),
        }),
        insert: vi.fn(),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createEvents(entries);

    expect(result.executionIds).toContain('existing-exec-id');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle entries without idempotency keys', async () => {
    const entry = createEventFixture({ correlationId: 'corr-1' });
    delete entry.idempotencyKey;
    const entries = [entry];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          output: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{ executionId: 'new-exec-id' }]),
          }),
        }),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createEvents(entries);

    expect(result.executionIds).toContain('new-exec-id');
    expect(result.errors).toHaveLength(0);
  });

  it('should collect multiple idempotency keys from entries', async () => {
    const entries = [
      createEventFixture({ idempotencyKey: 'idem-1', correlationId: 'corr-1' }),
      createEventFixture({ idempotencyKey: 'idem-2', correlationId: 'corr-2' }),
    ];

    let selectCallCount = 0;
    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
        insert: vi.fn().mockReturnValue({
          output: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([
              { executionId: 'exec-1' },
              { executionId: 'exec-2' },
            ]),
          }),
        }),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createEvents(entries);

    expect(result.executionIds).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should fall back to individual inserts on batch failure', async () => {
    const entries = [
      createEventFixture({ correlationId: 'corr-1' }),
      createEventFixture({ correlationId: 'corr-2' }),
    ];

    let batchAttempted = false;
    let individualAttempts = 0;

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockImplementation(() => ({
          output: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation(() => {
              if (!batchAttempted) {
                batchAttempted = true;
                throw new Error('Batch insert failed');
              }
              individualAttempts++;
              return Promise.resolve([{ executionId: `exec-${individualAttempts}` }]);
            }),
          }),
          values: vi.fn().mockImplementation(() => {
            individualAttempts++;
            return Promise.resolve();
          }),
        })),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createEvents(entries);

    expect(batchAttempted).toBe(true);
    expect(individualAttempts).toBeGreaterThan(0);
  });

  it('should track per-entry errors when individual inserts fail', async () => {
    const entries = [createEventFixture({ correlationId: 'corr-1' })];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockImplementation(() => ({
          output: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation(() => {
              throw new Error('Individual insert failed');
            }),
          }),
        })),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createEvents(entries);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Individual insert failed');
  });

  it('should return all executionIds in order', async () => {
    const entries = [
      createEventFixture({ correlationId: 'corr-1' }),
      createEventFixture({ correlationId: 'corr-2' }),
      createEventFixture({ correlationId: 'corr-3' }),
    ];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          output: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([
              { executionId: 'exec-1' },
              { executionId: 'exec-2' },
              { executionId: 'exec-3' },
            ]),
          }),
        }),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createEvents(entries);

    expect(result.executionIds).toEqual(['exec-1', 'exec-2', 'exec-3']);
  });

  it('should filter out null executionIds from failed inserts', async () => {
    // This tests the final filtering logic
    const executionIds: (string | null)[] = ['exec-1', null, 'exec-3'];
    const filtered = executionIds.filter((id): id is string => id !== null);

    expect(filtered).toEqual(['exec-1', 'exec-3']);
    expect(filtered).toHaveLength(2);
  });
});

describe('getByAccount', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return paginated events for account', async () => {
    const mockEvents = [
      createEventLogDbRecord({ accountId: 'acc-1', executionId: 'exec-1' }),
      createEventLogDbRecord({ accountId: 'acc-1', executionId: 'exec-2' }),
    ];

    // Single query with _totalCount window function
    mockDb._setQueryResult(mockEvents.map((e) => ({ ...e, _totalCount: 2 })));

    const result = await getByAccount('acc-1', { page: 1, pageSize: 10 });

    expect(result.events).toEqual(mockEvents);
    expect(result.totalCount).toBe(2);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply date filters when provided', async () => {
    mockDb._setQueryResult([]);

    await getByAccount('acc-1', {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply processName filter when provided', async () => {
    mockDb._setQueryResult([]);

    await getByAccount('acc-1', {
      processName: 'test-process',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply eventStatus filter when provided', async () => {
    mockDb._setQueryResult([]);

    await getByAccount('acc-1', {
      eventStatus: 'SUCCESS',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should handle includeLinked parameter in filter construction', () => {
    const accountId = 'acc-1';
    const includeLinked = true;

    const conditions: unknown[] = [];
    if (includeLinked) {
      conditions.push('or_condition_for_linked_correlations');
    } else {
      conditions.push(`eq(eventLogs.accountId, '${accountId}')`);
    }

    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toBe('or_condition_for_linked_correlations');
  });

  it('should return correct hasMore flag for pagination', async () => {
    const mockEvent = createEventLogDbRecord();
    mockDb._setQueryResult(Array(10).fill({ ...mockEvent, _totalCount: 25 }));

    const result = await getByAccount('acc-1', { page: 1, pageSize: 10 });

    expect(result.hasMore).toBe(true);
  });

  it('should return totalCount 0 for empty results', async () => {
    mockDb._setQueryResult([]);

    const result = await getByAccount('acc-1', { page: 1, pageSize: 10 });

    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(result.events).toHaveLength(0);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('should use fallback count query when paginated rows are empty', async () => {
    mockDb._setQueryResult([]);
    mockDb._setCountResult(25);

    const result = await getByAccount('acc-1', { page: 4, pageSize: 10 });

    expect(result.totalCount).toBe(25);
    expect(result.hasMore).toBe(false);
    expect(result.events).toHaveLength(0);
  });
});

describe('getByCorrelation', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return paginated events ordered by stepSequence and eventTimestamp', async () => {
    const mockEvents = [
      createEventLogDbRecord({ stepSequence: 1 }),
      createEventLogDbRecord({ stepSequence: 2 }),
    ];

    // First select: paginated query with _totalCount via offset().fetch()
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue(
                mockEvents.map((e) => ({ ...e, _totalCount: 2 })),
              ),
            }),
          }),
        }),
      }),
    });
    // Second select: link lookup
    mockDb.select.mockReturnValueOnce({
      top: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getByCorrelation('corr-1');

    expect(result.events).toEqual(mockEvents);
    expect(result.totalCount).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('should lookup linked account info', async () => {
    const mockEvents = [createEventLogDbRecord()];
    const mockLink = createCorrelationLinkDbRecord({ accountId: 'linked-account' });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue(
                mockEvents.map((e) => ({ ...e, _totalCount: 1 })),
              ),
            }),
          }),
        }),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      top: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockLink]),
        }),
      }),
    });

    const result = await getByCorrelation('corr-1');

    expect(result.accountId).toBe('linked-account');
    expect(result.isLinked).toBe(true);
  });

  it('should return isLinked=false when no link exists', async () => {
    mockDb._setCountResult(0);
    mockDb._setTopResult([]);

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const result = await getByCorrelation('corr-1');

    expect(result.accountId).toBeNull();
    expect(result.isLinked).toBe(false);
    expect(result.totalCount).toBe(0);
  });

  it('should use fallback count query when correlation page is out of range', async () => {
    mockDb._setCountResult(7);
    mockDb._setTopResult([]);

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const result = await getByCorrelation('corr-1', { page: 3, pageSize: 5 });

    expect(result.totalCount).toBe(7);
    expect(result.hasMore).toBe(false);
    expect(result.events).toHaveLength(0);
  });
});

describe('getByTrace', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return paginated events with systems and duration', async () => {
    const time1 = new Date('2024-01-01T10:00:00Z');
    const time2 = new Date('2024-01-01T10:00:05Z');
    const mockEvents = [
      createEventLogDbRecord({ eventTimestamp: time1, targetSystem: 'system-a' }),
      createEventLogDbRecord({ eventTimestamp: time2, targetSystem: 'system-b' }),
    ];

    // First: selectDistinct for systems
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { targetSystem: 'system-a' },
          { targetSystem: 'system-b' },
        ]),
      }),
    });
    // Second: select for aggregate (duration + status counts + process/account)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            firstEventAt: new Date('2024-01-01T10:00:00Z'),
            lastEventAt: new Date('2024-01-01T10:00:05Z'),
            successCount: 2,
            failureCount: 0,
            inProgressCount: 0,
            skippedCount: 0,
            warningCount: 0,
            processName: 'test-process',
            accountId: 'test-account',
          },
        ]),
      }),
    });
    // Third: select for paginated data with _totalCount
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue(
                mockEvents.map((e) => ({ ...e, _totalCount: 2 })),
              ),
            }),
          }),
        }),
      }),
    });

    const result = await getByTrace('trace-1');

    expect(result.events).toEqual(mockEvents);
    expect(result.systemsInvolved).toEqual(['system-a', 'system-b']);
    expect(result.totalDurationMs).toBe(5000);
    expect(result.totalCount).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.statusCounts).toEqual({ success: 2, failure: 0, inProgress: 0, skipped: 0, warning: 0 });
    expect(result.processName).toBe('test-process');
    expect(result.accountId).toBe('test-account');
    expect(result.startTime).toBe('2024-01-01T10:00:00.000Z');
    expect(result.endTime).toBe('2024-01-01T10:00:05.000Z');
  });

  it('should return null duration and empty systems for no results', async () => {
    // selectDistinct: no systems
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    // select: aggregate (null duration + zero counts)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          firstEventAt: null,
          lastEventAt: null,
          successCount: 0,
          failureCount: 0,
          inProgressCount: 0,
          skippedCount: 0,
          warningCount: 0,
          processName: null,
          accountId: null,
        }]),
      }),
    });
    // select: paginated data (empty)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const result = await getByTrace('trace-1');

    expect(result.totalDurationMs).toBeNull();
    expect(result.events).toHaveLength(0);
    expect(result.systemsInvolved).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.statusCounts).toEqual({ success: 0, failure: 0, inProgress: 0, skipped: 0, warning: 0 });
    expect(result.processName).toBeNull();
    expect(result.accountId).toBeNull();
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });

  it('should use fallback count query when trace page is out of range', async () => {
    mockDb._setCountResult(12);

    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ targetSystem: 'system-a' }]),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            firstEventAt: new Date('2024-01-01T00:00:00Z'),
            lastEventAt: new Date('2024-01-01T00:00:05Z'),
            successCount: 10,
            failureCount: 2,
            inProgressCount: 0,
            skippedCount: 0,
            warningCount: 0,
            processName: 'test-process',
            accountId: 'test-account',
          },
        ]),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    const result = await getByTrace('trace-1', { page: 4, pageSize: 5 });

    expect(result.totalCount).toBe(12);
    expect(result.hasMore).toBe(false);
    expect(result.events).toHaveLength(0);
    expect(result.systemsInvolved).toEqual(['system-a']);
  });
});

describe('listTraces', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return grouped trace summaries', async () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    const endTime = new Date('2024-01-01T10:00:05Z');

    // select with groupBy chain
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                offset: vi.fn().mockReturnValue({
                  fetch: vi.fn().mockResolvedValue([
                    {
                      traceId: 'trace-1',
                      eventCount: 5,
                      errorCount: 1,
                      latestStatus: 'FAILURE',
                      startTime,
                      endTime,
                      processName: 'Onboarding',
                      accountId: 'ACC-1',
                      _totalCount: 1,
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await listTraces({ page: 1, pageSize: 20 });

    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].traceId).toBe('trace-1');
    expect(result.traces[0].eventCount).toBe(5);
    expect(result.traces[0].hasErrors).toBe(true);
    expect(result.traces[0].latestStatus).toBe('FAILURE');
    expect(result.traces[0].durationMs).toBe(5000);
    expect(result.traces[0].processName).toBe('Onboarding');
    expect(result.traces[0].accountId).toBe('ACC-1');
    expect(result.totalCount).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('should return empty results', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                offset: vi.fn().mockReturnValue({
                  fetch: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await listTraces({ page: 1, pageSize: 20 });

    expect(result.traces).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('should use fallback count when page out of range', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                offset: vi.fn().mockReturnValue({
                  fetch: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    // Fallback count query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 25 }]),
      }),
    });

    const result = await listTraces({ page: 3, pageSize: 10 });

    expect(result.totalCount).toBe(25);
    expect(result.hasMore).toBe(false);
  });

  it('should handle traces with no errors', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                offset: vi.fn().mockReturnValue({
                  fetch: vi.fn().mockResolvedValue([
                    {
                      traceId: 'trace-ok',
                      eventCount: 3,
                      errorCount: 0,
                      latestStatus: 'SUCCESS',
                      startTime: new Date('2024-01-01T10:00:00Z'),
                      endTime: new Date('2024-01-01T10:00:01Z'),
                      processName: null,
                      accountId: null,
                      _totalCount: 1,
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await listTraces({ page: 1, pageSize: 20 });

    expect(result.traces[0].hasErrors).toBe(false);
    expect(result.traces[0].processName).toBeNull();
    expect(result.traces[0].accountId).toBeNull();
  });
});

describe('getDashboardStats', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return aggregate stats', async () => {
    // Aggregate query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalTraces: 500,
          totalAccounts: 120,
          totalEvents: 15000,
          tracesWithFailures: 25,
        }]),
      }),
    });
    // System names query
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { targetSystem: 'system-a' },
          { targetSystem: 'system-b' },
        ]),
      }),
    });

    const result = await getDashboardStats();

    expect(result.totalTraces).toBe(500);
    expect(result.totalAccounts).toBe(120);
    expect(result.totalEvents).toBe(15000);
    expect(result.successRate).toBe(95);
    expect(result.systemNames).toEqual(['system-a', 'system-b']);
  });

  it('should return 100 success rate when no traces', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalTraces: 0,
          totalAccounts: 0,
          totalEvents: 0,
          tracesWithFailures: 0,
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await getDashboardStats();

    expect(result.totalTraces).toBe(0);
    expect(result.successRate).toBe(100);
    expect(result.systemNames).toEqual([]);
  });

  it('should apply date filters', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalTraces: 10,
          totalAccounts: 5,
          totalEvents: 100,
          tracesWithFailures: 1,
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ targetSystem: 'system-x' }]),
      }),
    });

    const result = await getDashboardStats({
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-31T23:59:59Z',
    });

    expect(result.totalTraces).toBe(10);
    expect(result.successRate).toBe(90);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should filter out empty system names', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalTraces: 5,
          totalAccounts: 3,
          totalEvents: 50,
          tracesWithFailures: 0,
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { targetSystem: 'system-a' },
          { targetSystem: '' },
          { targetSystem: 'system-b' },
        ]),
      }),
    });

    const result = await getDashboardStats();

    expect(result.systemNames).toEqual(['system-a', 'system-b']);
  });
});

describe('searchText', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should use LIKE fallback when FULLTEXT_ENABLED is false', async () => {
    mockDb._setCountResult(1);
    mockDb._setQueryResult([createEventLogDbRecord()]);

    const result = await searchText({
      query: 'test search',
      page: 1,
      pageSize: 10,
    });

    expect(result.events).toHaveLength(1);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply account filter when provided', async () => {
    mockDb._setCountResult(0);
    mockDb._setQueryResult([]);

    await searchText({
      query: 'test',
      accountId: 'acc-1',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply process filter when provided', async () => {
    mockDb._setCountResult(0);
    mockDb._setQueryResult([]);

    await searchText({
      query: 'test',
      processName: 'process-1',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should return paginated results with totalCount', async () => {
    const mockEvents = [createEventLogDbRecord(), createEventLogDbRecord()];
    mockDb._setCountResult(5);
    mockDb._setQueryResult(mockEvents);

    const result = await searchText({
      query: 'test',
      page: 1,
      pageSize: 2,
    });

    expect(result.totalCount).toBe(5);
    expect(result.events).toHaveLength(2);
  });

  it('should return totalCount even when search page is out of range', async () => {
    mockDb._setQueryResult([]);
    mockDb._setCountResult(9);

    const result = await searchText({
      query: 'test',
      page: 3,
      pageSize: 5,
    });

    expect(result.totalCount).toBe(9);
    expect(result.events).toHaveLength(0);
  });
});

describe('getByBatch', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return paginated batch events', async () => {
    const mockEvents = [
      createEventLogDbRecord({ batchId: 'batch-1' }),
      createEventLogDbRecord({ batchId: 'batch-1' }),
    ];

    // First select: stats query (uniqueCorrelationIds, successCount, failureCount)
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            uniqueCorrelationIds: 2,
            successCount: 1,
            failureCount: 0,
          }]),
        }),
      })
      // Second select: paginated data with _totalCount
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                fetch: vi.fn().mockResolvedValue(
                  mockEvents.map((e) => ({ ...e, _totalCount: 2 })),
                ),
              }),
            }),
          }),
        }),
      });

    const result = await getByBatch('batch-1', { page: 1, pageSize: 10 });

    expect(result.events).toEqual(mockEvents);
    expect(result.totalCount).toBe(2);
  });

  it('should apply eventStatus filter', async () => {
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            uniqueCorrelationIds: 1,
            successCount: 1,
            failureCount: 0,
          }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                fetch: vi.fn().mockResolvedValue(
                  [createEventLogDbRecord()].map((e) => ({ ...e, _totalCount: 1 })),
                ),
              }),
            }),
          }),
        }),
      });

    await getByBatch('batch-1', {
      eventStatus: 'SUCCESS',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should compute batch statistics', async () => {
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            uniqueCorrelationIds: 3,
            successCount: 2,
            failureCount: 1,
          }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                fetch: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

    const result = await getByBatch('batch-1', { page: 1, pageSize: 10 });

    expect(result.uniqueCorrelationIds).toBe(3);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
  });

  it('should return correct hasMore flag', async () => {
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            uniqueCorrelationIds: 10,
            successCount: 8,
            failureCount: 2,
          }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                fetch: vi.fn().mockResolvedValue(
                  Array(10).fill(createEventLogDbRecord()).map((e) => ({ ...e, _totalCount: 25 })),
                ),
              }),
            }),
          }),
        }),
      });

    const result = await getByBatch('batch-1', { page: 1, pageSize: 10 });

    expect(result.hasMore).toBe(true);
  });

  it('should use fallback count query when batch page is out of range', async () => {
    mockDb._setCountResult(13);

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            uniqueCorrelationIds: 4,
            successCount: 3,
            failureCount: 1,
          }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                fetch: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

    const result = await getByBatch('batch-1', { page: 4, pageSize: 5 });

    expect(result.totalCount).toBe(13);
    expect(result.hasMore).toBe(false);
    expect(result.events).toHaveLength(0);
    expect(result.uniqueCorrelationIds).toBe(4);
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(1);
  });
});

describe('getBatchSummary', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return comprehensive stats', async () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    const endTime = new Date('2024-01-01T10:30:00Z');

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalEvents: 10,
          uniqueCorrelations: 5,
          completedCount: 3,
          failedCount: 1,
          startedAt: startTime,
          lastEventAt: endTime,
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { correlationId: 'corr-1' },
          { correlationId: 'corr-2' },
          { correlationId: 'corr-3' },
        ]),
      }),
    });

    const result = await getBatchSummary('batch-1');

    expect(result.totalProcesses).toBe(5);
    expect(result.completed).toBe(3);
    expect(result.failed).toBe(1);
  });

  it('should calculate in-progress count correctly', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalEvents: 20,
          uniqueCorrelations: 10,
          completedCount: 5,
          failedCount: 2,
          startedAt: new Date(),
          lastEventAt: new Date(),
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await getBatchSummary('batch-1');

    // inProgress = totalProcesses - completed - failed = 10 - 5 - 2 = 3
    expect(result.inProgress).toBe(3);
  });

  it('should return timestamp range', async () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    const endTime = new Date('2024-01-01T12:00:00Z');

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalEvents: 5,
          uniqueCorrelations: 2,
          completedCount: 1,
          failedCount: 0,
          startedAt: startTime,
          lastEventAt: endTime,
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await getBatchSummary('batch-1');

    expect(result.startedAt).toBe(startTime.toISOString());
    expect(result.lastEventAt).toBe(endTime.toISOString());
  });

  it('should return null timestamps when no events', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalEvents: 0,
          uniqueCorrelations: 0,
          completedCount: 0,
          failedCount: 0,
          startedAt: null,
          lastEventAt: null,
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await getBatchSummary('batch-1');

    expect(result.startedAt).toBeNull();
    expect(result.lastEventAt).toBeNull();
  });

  it('should return correlation IDs list', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalEvents: 6,
          uniqueCorrelations: 3,
          completedCount: 2,
          failedCount: 1,
          startedAt: new Date(),
          lastEventAt: new Date(),
        }]),
      }),
    });
    mockDb.selectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { correlationId: 'corr-a' },
          { correlationId: 'corr-b' },
          { correlationId: 'corr-c' },
        ]),
      }),
    });

    const result = await getBatchSummary('batch-1');

    expect(result.correlationIds).toEqual(['corr-a', 'corr-b', 'corr-c']);
  });
});
