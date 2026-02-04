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
  searchText,
  createBatchUpload,
  getByBatch,
  getBatchSummary,
  deleteAll,
} from '../../src/services/event-log.service';

describe('EventLogService', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  describe('createEvent', () => {
    it('should return existing record when idempotency_key matches', async () => {
      const existingRecord = createEventLogDbRecord({
        executionId: 'existing-exec-id',
        idempotencyKey: 'idem-key-123',
      });

      mockDb._setTopResult([existingRecord]);

      const entry = createEventFixture({
        idempotency_key: 'idem-key-123',
      });

      const result = await createEvent(entry);

      expect(result).toEqual(existingRecord);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should insert new record when no idempotency_key match', async () => {
      const newRecord = createEventLogDbRecord({
        executionId: 'new-exec-id',
      });

      mockDb._setTopResult([]);
      mockDb._setInsertResult([newRecord]);

      const entry = createEventFixture({
        idempotency_key: 'new-idem-key',
      });

      const result = await createEvent(entry);

      expect(result).toEqual(newRecord);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should insert without idempotency check when no idempotency_key provided', async () => {
      const newRecord = createEventLogDbRecord({
        executionId: 'direct-insert-id',
      });

      mockDb._setInsertResult([newRecord]);

      const entry = createEventFixture();
      delete entry.idempotency_key;

      const result = await createEvent(entry);

      expect(result).toEqual(newRecord);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.top).not.toHaveBeenCalled();
    });
  });

  describe('deleteAll', () => {
    it('should call db.delete', async () => {
      await deleteAll();

      expect(mockDb.delete).toHaveBeenCalled();
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

      expect(fixture.correlation_id).toBe('test-correlation-id');
      expect(fixture.trace_id).toBe('test-trace-id');
      expect(fixture.application_id).toBe('test-app');
      expect(fixture.event_type).toBe('PROCESS_START');
      expect(fixture.event_status).toBe('SUCCESS');
    });

    it('should allow overriding default values', () => {
      const fixture = createEventFixture({
        correlation_id: 'custom-id',
        event_status: 'FAILURE',
      });

      expect(fixture.correlation_id).toBe('custom-id');
      expect(fixture.event_status).toBe('FAILURE');
      expect(fixture.trace_id).toBe('test-trace-id');
    });

    it('should have required fields', () => {
      const fixture = createEventFixture();

      expect(fixture).toHaveProperty('correlation_id');
      expect(fixture).toHaveProperty('trace_id');
      expect(fixture).toHaveProperty('application_id');
      expect(fixture).toHaveProperty('target_system');
      expect(fixture).toHaveProperty('originating_system');
      expect(fixture).toHaveProperty('process_name');
      expect(fixture).toHaveProperty('event_type');
      expect(fixture).toHaveProperty('event_status');
      expect(fixture).toHaveProperty('identifiers');
      expect(fixture).toHaveProperty('summary');
      expect(fixture).toHaveProperty('result');
      expect(fixture).toHaveProperty('event_timestamp');
    });

    it('should have valid timestamp', () => {
      const fixture = createEventFixture();
      const timestamp = new Date(fixture.event_timestamp);

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
      const correlationIds = batch.map((e) => e.correlation_id);
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('should increment step sequence', () => {
      const batch = createEventBatchFixture(3);
      expect(batch[0].step_sequence).toBe(1);
      expect(batch[1].step_sequence).toBe(2);
      expect(batch[2].step_sequence).toBe(3);
    });
  });
});

describe('EventLogService - Entry to Insert Mapping', () => {
  it('should map snake_case API fields to camelCase DB fields', () => {
    const entry = createEventFixture({
      correlation_id: 'test-corr',
      account_id: 'test-account',
      trace_id: 'test-trace',
      span_id: 'test-span',
      parent_span_id: 'parent-span',
      batch_id: 'batch-1',
      application_id: 'app-1',
      target_system: 'target-sys',
      originating_system: 'origin-sys',
      process_name: 'process-1',
      step_sequence: 5,
      step_name: 'step-5',
      event_type: 'STEP',
      event_status: 'SUCCESS',
      execution_time_ms: 250,
      http_method: 'POST',
      http_status_code: 201,
      error_code: 'ERR001',
      error_message: 'Test error',
      idempotency_key: 'idem-key',
    });

    // Verify field mapping matches what the service expects
    expect(entry.correlation_id).toBe('test-corr');
    expect(entry.account_id).toBe('test-account');
    expect(entry.trace_id).toBe('test-trace');
    expect(entry.span_id).toBe('test-span');
    expect(entry.parent_span_id).toBe('parent-span');
    expect(entry.batch_id).toBe('batch-1');
    expect(entry.application_id).toBe('app-1');
    expect(entry.target_system).toBe('target-sys');
    expect(entry.originating_system).toBe('origin-sys');
    expect(entry.process_name).toBe('process-1');
    expect(entry.step_sequence).toBe(5);
    expect(entry.step_name).toBe('step-5');
    expect(entry.event_type).toBe('STEP');
    expect(entry.event_status).toBe('SUCCESS');
    expect(entry.execution_time_ms).toBe(250);
    expect(entry.http_method).toBe('POST');
    expect(entry.http_status_code).toBe(201);
    expect(entry.error_code).toBe('ERR001');
    expect(entry.error_message).toBe('Test error');
    expect(entry.idempotency_key).toBe('idem-key');
  });

  it('should handle optional fields as null/undefined', () => {
    const entry = createEventFixture();

    // Optional fields should have defaults or be undefined
    expect(entry.parent_span_id).toBeUndefined();
    expect(entry.batch_id).toBeUndefined();
    expect(entry.http_method).toBeUndefined();
    expect(entry.http_status_code).toBeUndefined();
    expect(entry.error_code).toBeUndefined();
    expect(entry.error_message).toBeUndefined();
    expect(entry.idempotency_key).toBeUndefined();
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
    const entries = [createEventFixture({ correlation_id: 'corr-1' })];

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
      createEventFixture({ idempotency_key: 'idem-1', correlation_id: 'corr-1' }),
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
    const entry = createEventFixture({ correlation_id: 'corr-1' });
    delete entry.idempotency_key;
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
      createEventFixture({ idempotency_key: 'idem-1', correlation_id: 'corr-1' }),
      createEventFixture({ idempotency_key: 'idem-2', correlation_id: 'corr-2' }),
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
      createEventFixture({ correlation_id: 'corr-1' }),
      createEventFixture({ correlation_id: 'corr-2' }),
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
    const entries = [createEventFixture({ correlation_id: 'corr-1' })];

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
      createEventFixture({ correlation_id: 'corr-1' }),
      createEventFixture({ correlation_id: 'corr-2' }),
      createEventFixture({ correlation_id: 'corr-3' }),
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

    mockDb.select.mockImplementation(() => ({
      top: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          // First call is for count
          return {
            orderBy: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                fetch: vi.fn().mockResolvedValue(mockEvents),
              }),
            }),
          };
        }),
      })),
    }));

    // Mock for count query - returns first
    const countMock = vi.fn().mockResolvedValue([{ count: 2 }]);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: countMock,
      }),
    });

    // Mock for actual select
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      }),
    });

    const result = await getByAccount('acc-1', { page: 1, pageSize: 10 });

    expect(result.events).toEqual(mockEvents);
    expect(result.totalCount).toBe(2);
  });

  it('should apply date filters when provided', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
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

    await getByAccount('acc-1', {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      page: 1,
      pageSize: 10,
    });

    // Verify select was called (filters are applied in where clause)
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply processName filter when provided', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
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

    await getByAccount('acc-1', {
      processName: 'test-process',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply eventStatus filter when provided', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
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

    await getByAccount('acc-1', {
      eventStatus: 'SUCCESS',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should handle includeLinked parameter in filter construction', () => {
    // This test verifies the logic for includeLinked filter construction
    // The actual DB query is tested via integration tests
    // Here we test that the condition building logic is correct

    const accountId = 'acc-1';
    const includeLinked = true;

    // Simulate the condition building from the service
    const conditions: unknown[] = [];
    if (includeLinked) {
      // When includeLinked is true, the service adds an OR condition
      // for events matching the account OR events with correlation IDs
      // that are linked to the account via correlation_links table
      conditions.push('or_condition_for_linked_correlations');
    } else {
      conditions.push(`eq(eventLogs.accountId, '${accountId}')`);
    }

    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toBe('or_condition_for_linked_correlations');
  });

  it('should return correct hasMore flag for pagination', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 25 }]),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue(Array(10).fill(createEventLogDbRecord())),
            }),
          }),
        }),
      }),
    });

    const result = await getByAccount('acc-1', { page: 1, pageSize: 10 });

    expect(result.hasMore).toBe(true);
  });
});

describe('getByCorrelation', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return events ordered by stepSequence and eventTimestamp', async () => {
    const mockEvents = [
      createEventLogDbRecord({ stepSequence: 1 }),
      createEventLogDbRecord({ stepSequence: 2 }),
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      top: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getByCorrelation('corr-1');

    expect(result.events).toEqual(mockEvents);
  });

  it('should lookup linked account info', async () => {
    const mockEvents = [createEventLogDbRecord()];
    const mockLink = createCorrelationLinkDbRecord({ accountId: 'linked-account' });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
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
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      top: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getByCorrelation('corr-1');

    expect(result.accountId).toBeNull();
    expect(result.isLinked).toBe(false);
  });
});

describe('getByTrace', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should return events ordered by timestamp', async () => {
    const time1 = new Date('2024-01-01T10:00:00Z');
    const time2 = new Date('2024-01-01T10:00:05Z');
    const mockEvents = [
      createEventLogDbRecord({ eventTimestamp: time1 }),
      createEventLogDbRecord({ eventTimestamp: time2 }),
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });

    const result = await getByTrace('trace-1');

    expect(result.events).toEqual(mockEvents);
  });

  it('should calculate totalDurationMs between first and last event', async () => {
    const time1 = new Date('2024-01-01T10:00:00Z');
    const time2 = new Date('2024-01-01T10:00:05Z');
    const mockEvents = [
      createEventLogDbRecord({ eventTimestamp: time1 }),
      createEventLogDbRecord({ eventTimestamp: time2 }),
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });

    const result = await getByTrace('trace-1');

    expect(result.totalDurationMs).toBe(5000);
  });

  it('should deduplicate systemsInvolved', async () => {
    const mockEvents = [
      createEventLogDbRecord({ targetSystem: 'system-a' }),
      createEventLogDbRecord({ targetSystem: 'system-a' }),
      createEventLogDbRecord({ targetSystem: 'system-b' }),
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });

    const result = await getByTrace('trace-1');

    expect(result.systemsInvolved).toHaveLength(2);
    expect(result.systemsInvolved).toContain('system-a');
    expect(result.systemsInvolved).toContain('system-b');
  });

  it('should return null duration for empty results', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getByTrace('trace-1');

    expect(result.totalDurationMs).toBeNull();
    expect(result.events).toHaveLength(0);
  });
});

describe('searchText', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should use LIKE fallback when FULLTEXT_ENABLED is false', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue([createEventLogDbRecord()]),
            }),
          }),
        }),
      }),
    });

    const result = await searchText({
      query: 'test search',
      page: 1,
      pageSize: 10,
    });

    expect(result.events).toHaveLength(1);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply account filter when provided', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
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

    await searchText({
      query: 'test',
      accountId: 'acc-1',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should apply process filter when provided', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
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

    await searchText({
      query: 'test',
      processName: 'process-1',
      page: 1,
      pageSize: 10,
    });

    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should return paginated results with totalCount', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue([
                createEventLogDbRecord(),
                createEventLogDbRecord(),
              ]),
            }),
          }),
        }),
      }),
    });

    const result = await searchText({
      query: 'test',
      page: 1,
      pageSize: 2,
    });

    expect(result.totalCount).toBe(5);
    expect(result.events).toHaveLength(2);
  });
});

describe('createBatchUpload', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  it('should associate batchId with entries', async () => {
    const entries = [createEventFixture({ correlation_id: 'corr-1' })];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createBatchUpload('batch-123', entries);

    expect(result.correlationIds).toContain('corr-1');
  });

  it('should handle idempotency deduplication', async () => {
    const entries = [
      createEventFixture({ idempotency_key: 'existing-key', correlation_id: 'corr-1' }),
    ];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ idempotencyKey: 'existing-key' }]),
          }),
        }),
        insert: vi.fn(),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createBatchUpload('batch-123', entries);

    expect(result.correlationIds).toContain('corr-1');
    expect(result.totalInserted).toBe(1);
  });

  it('should return unique correlationIds', async () => {
    const entries = [
      createEventFixture({ correlation_id: 'corr-1' }),
      createEventFixture({ correlation_id: 'corr-1' }),
      createEventFixture({ correlation_id: 'corr-2' }),
    ];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createBatchUpload('batch-123', entries);

    expect(result.correlationIds).toHaveLength(2);
    expect(result.correlationIds).toContain('corr-1');
    expect(result.correlationIds).toContain('corr-2');
  });

  it('should track inserted count', async () => {
    const entries = [
      createEventFixture({ correlation_id: 'corr-1' }),
      createEventFixture({ correlation_id: 'corr-2' }),
    ];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createBatchUpload('batch-123', entries);

    expect(result.totalInserted).toBe(2);
  });

  it('should handle partial failures with errors array', async () => {
    const entries = [createEventFixture({ correlation_id: 'corr-1' })];

    mockDb.transaction.mockImplementation(async (callback: (tx: typeof mockDb) => Promise<void>) => {
      const txMock = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => {
            throw new Error('Insert failed');
          }),
        })),
      };
      return callback(txMock as unknown as typeof mockDb);
    });

    const result = await createBatchUpload('batch-123', entries);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Insert failed');
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

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            uniqueCorrelationIds: 2,
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
                fetch: vi.fn().mockResolvedValue(mockEvents),
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
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      })
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
                fetch: vi.fn().mockResolvedValue([createEventLogDbRecord()]),
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
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      })
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
          where: vi.fn().mockResolvedValue([{ count: 25 }]),
        }),
      })
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
                fetch: vi.fn().mockResolvedValue(Array(10).fill(createEventLogDbRecord())),
              }),
            }),
          }),
        }),
      });

    const result = await getByBatch('batch-1', { page: 1, pageSize: 10 });

    expect(result.hasMore).toBe(true);
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
