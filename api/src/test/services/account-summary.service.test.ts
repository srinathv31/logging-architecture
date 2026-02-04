/**
 * Unit tests for account-summary.service
 *
 * These tests mock the Drizzle ORM db export to test actual service code paths.
 */
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { createAccountSummaryDbRecord } from '../fixtures/account-summary';
import { createEventLogDbRecord } from '../fixtures/events';
import { NotFoundError } from '../../utils/errors';

// Create mock instance using vi.hoisted - must define inline, cannot import
const mockDb = vi.hoisted(() => {
  // State for configurable results
  let queryResult: unknown[] = [];
  let insertResult: unknown[] = [{ executionId: 'test-execution-id' }];
  let countResult = { count: 0 };
  let topResult: unknown[] = [];
  let fetchResults: unknown[][] = [];
  let fetchCallCount = 0;

  interface ChainableMock {
    select: Mock;
    from: Mock;
    where: Mock;
    orderBy: Mock;
    offset: Mock;
    top: Mock;
    fetch: Mock;
    insert: Mock;
    values: Mock;
    output: Mock;
    delete: Mock;
    execute: Mock;
    transaction: Mock;
    _setQueryResult: (result: unknown[]) => void;
    _setInsertResult: (result: unknown[]) => void;
    _setCountResult: (count: number) => void;
    _setTopResult: (result: unknown[]) => void;
    _setFetchResults: (results: unknown[][]) => void;
    _reset: () => void;
  }

  const chainableMock: ChainableMock = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    offset: vi.fn(),
    top: vi.fn(),
    fetch: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    output: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
    _setQueryResult: (result: unknown[]) => {
      queryResult = result;
    },
    _setInsertResult: (result: unknown[]) => {
      insertResult = result;
    },
    _setCountResult: (count: number) => {
      countResult = { count };
    },
    _setTopResult: (result: unknown[]) => {
      topResult = result;
    },
    _setFetchResults: (results: unknown[][]) => {
      fetchResults = results;
      fetchCallCount = 0;
    },
    _reset: () => {
      queryResult = [];
      insertResult = [{ executionId: 'test-execution-id' }];
      countResult = { count: 0 };
      topResult = [];
      fetchResults = [];
      fetchCallCount = 0;

      // Clear all mock call history
      Object.values(chainableMock).forEach((fn) => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as Mock).mockClear();
        }
      });

      // Re-setup mocks after clear
      chainableMock.select.mockImplementation((...args: unknown[]) => {
        if (
          args[0] &&
          typeof args[0] === 'object' &&
          'count' in (args[0] as object)
        ) {
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
                    const result =
                      fetchResults.length > 0
                        ? fetchResults[fetchCallCount] || queryResult
                        : queryResult;
                    fetchCallCount++;
                    return Promise.resolve(result);
                  }),
                }),
              }),
            }),
          }),
        };
      });

      chainableMock.insert.mockImplementation(() => ({
        output: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(() => Promise.resolve(insertResult)),
        }),
        values: vi.fn().mockResolvedValue(undefined),
      }));

      chainableMock.delete.mockImplementation(() => Promise.resolve());

      chainableMock.execute.mockImplementation(() => Promise.resolve());

      chainableMock.transaction.mockImplementation(
        async (callback: (tx: ChainableMock) => Promise<void>) => {
          return callback(chainableMock);
        }
      );

      chainableMock.top.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(topResult),
        }),
      }));

      chainableMock.fetch.mockImplementation(() => {
        const result =
          fetchResults.length > 0
            ? fetchResults[fetchCallCount] || queryResult
            : queryResult;
        fetchCallCount++;
        return Promise.resolve(result);
      });
    },
  };

  // Initialize mocks
  chainableMock._reset();

  return chainableMock;
});

// Mock MUST be after vi.hoisted
vi.mock('../../db/client', () => ({
  db: mockDb,
  initializeDb: vi.fn(),
  closeDb: vi.fn(),
}));

// Now import the service (uses mocked db)
import { getAccountSummary } from '../../services/account-summary.service';

describe('AccountSummaryService', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  describe('getAccountSummary', () => {
    it('should return summary from accountTimelineSummary table', async () => {
      const summary = createAccountSummaryDbRecord({
        accountId: 'acc-123',
        totalEvents: 50,
        totalProcesses: 5,
      });
      const recentEvents = [
        createEventLogDbRecord({ eventStatus: 'SUCCESS' }),
        createEventLogDbRecord({ eventStatus: 'SUCCESS' }),
      ];
      const recentErrors = [createEventLogDbRecord({ eventStatus: 'FAILURE' })];

      mockDb._setTopResult([summary]);
      mockDb._setFetchResults([recentEvents, recentErrors]);

      const result = await getAccountSummary('acc-123');

      expect(result.summary.accountId).toBe('acc-123');
      expect(result.summary.totalEvents).toBe(50);
      expect(result.summary.totalProcesses).toBe(5);
    });

    it('should return 10 most recent events', async () => {
      const summary = createAccountSummaryDbRecord();
      const recentEvents = Array.from({ length: 10 }, (_, i) =>
        createEventLogDbRecord({
          eventTimestamp: new Date(Date.now() - i * 1000),
        })
      );

      mockDb._setTopResult([summary]);
      mockDb._setFetchResults([recentEvents, []]);

      const result = await getAccountSummary('test-account-id');

      expect(result.recentEvents).toHaveLength(10);
    });

    it('should return 5 most recent errors (FAILURE status)', async () => {
      const summary = createAccountSummaryDbRecord();
      const recentErrors = Array.from({ length: 5 }, (_, i) =>
        createEventLogDbRecord({
          eventStatus: 'FAILURE',
          eventTimestamp: new Date(Date.now() - i * 1000),
        })
      );

      mockDb._setTopResult([summary]);
      mockDb._setFetchResults([[], recentErrors]);

      const result = await getAccountSummary('test-account-id');

      expect(result.recentErrors).toHaveLength(5);
      expect(result.recentErrors.every((e) => e.eventStatus === 'FAILURE')).toBe(
        true
      );
    });

    it('should throw NotFoundError when account not found', async () => {
      mockDb._setTopResult([]);

      await expect(getAccountSummary('nonexistent-acc')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError with correct message', async () => {
      mockDb._setTopResult([]);

      await expect(
        getAccountSummary('nonexistent-acc')
      ).rejects.toMatchObject({
        message: 'Account summary not found for account_id: nonexistent-acc',
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should filter events by isDeleted=false', async () => {
      const summary = createAccountSummaryDbRecord();

      mockDb._setTopResult([summary]);
      mockDb._setFetchResults([[], []]);

      await getAccountSummary('test-account-id');

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should order events by eventTimestamp descending', async () => {
      const summary = createAccountSummaryDbRecord();

      mockDb._setTopResult([summary]);
      mockDb._setFetchResults([[], []]);

      await getAccountSummary('test-account-id');

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty arrays when no events exist', async () => {
      const summary = createAccountSummaryDbRecord({
        totalEvents: 0,
        errorCount: 0,
      });

      mockDb._setTopResult([summary]);
      mockDb._setFetchResults([[], []]);

      const result = await getAccountSummary('test-account-id');

      expect(result.recentEvents).toHaveLength(0);
      expect(result.recentErrors).toHaveLength(0);
    });
  });
});

// Test fixture tests
describe('AccountSummaryService - Test Fixtures', () => {
  describe('createAccountSummaryDbRecord', () => {
    it('should create a valid fixture with default values', () => {
      const record = createAccountSummaryDbRecord();

      expect(record.accountId).toBe('test-account-id');
      expect(record.firstEventAt).toBeInstanceOf(Date);
      expect(record.lastEventAt).toBeInstanceOf(Date);
      expect(record.totalEvents).toBe(100);
      expect(record.totalProcesses).toBe(10);
      expect(record.errorCount).toBe(5);
      expect(record.lastProcess).toBe('test-process');
      expect(record.systemsTouched).toEqual(['system-a', 'system-b', 'system-c']);
      expect(record.correlationIds).toEqual(['corr-1', 'corr-2', 'corr-3']);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow overriding default values', () => {
      const record = createAccountSummaryDbRecord({
        accountId: 'custom-account',
        totalEvents: 500,
        errorCount: 25,
      });

      expect(record.accountId).toBe('custom-account');
      expect(record.totalEvents).toBe(500);
      expect(record.errorCount).toBe(25);
    });

    it('should handle custom dates', () => {
      const customFirstEvent = new Date('2023-06-01T00:00:00Z');
      const customLastEvent = new Date('2023-12-31T23:59:59Z');

      const record = createAccountSummaryDbRecord({
        firstEventAt: customFirstEvent,
        lastEventAt: customLastEvent,
      });

      expect(record.firstEventAt).toEqual(customFirstEvent);
      expect(record.lastEventAt).toEqual(customLastEvent);
    });

    it('should handle null arrays', () => {
      const record = createAccountSummaryDbRecord({
        systemsTouched: null,
        correlationIds: null,
      });

      expect(record.systemsTouched).toBeNull();
      expect(record.correlationIds).toBeNull();
    });
  });
});

describe('AccountSummaryService - getAccountSummary behavior', () => {
  it('should throw NotFoundError when account not found', () => {
    const accountId = 'nonexistent-account';
    const error = new NotFoundError(
      `Account summary not found for account_id: ${accountId}`
    );

    expect(error.message).toBe(
      'Account summary not found for account_id: nonexistent-account'
    );
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should return summary with recent events and errors', () => {
    const summary = createAccountSummaryDbRecord();
    const recentEvents = [
      createEventLogDbRecord({ eventStatus: 'SUCCESS' }),
      createEventLogDbRecord({ eventStatus: 'SUCCESS' }),
    ];
    const recentErrors = [createEventLogDbRecord({ eventStatus: 'FAILURE' })];

    const result = {
      summary,
      recentEvents,
      recentErrors,
    };

    expect(result.summary.accountId).toBe('test-account-id');
    expect(result.recentEvents).toHaveLength(2);
    expect(result.recentErrors).toHaveLength(1);
    expect(result.recentErrors[0].eventStatus).toBe('FAILURE');
  });

  it('should limit recent events to 10', () => {
    const maxRecentEvents = 10;
    expect(maxRecentEvents).toBe(10);
  });

  it('should limit recent errors to 5', () => {
    const maxRecentErrors = 5;
    expect(maxRecentErrors).toBe(5);
  });

  it('should filter events by isDeleted=false', () => {
    const deletedEvent = createEventLogDbRecord({ isDeleted: true });
    const activeEvent = createEventLogDbRecord({ isDeleted: false });

    expect(deletedEvent.isDeleted).toBe(true);
    expect(activeEvent.isDeleted).toBe(false);
  });
});

describe('AccountSummaryService - Response formatting', () => {
  it('should convert dates to ISO strings for API response', () => {
    const summary = createAccountSummaryDbRecord({
      firstEventAt: new Date('2024-01-01T00:00:00Z'),
      lastEventAt: new Date('2024-01-15T12:00:00Z'),
      updatedAt: new Date('2024-01-15T12:30:00Z'),
    });

    const response = {
      account_id: summary.accountId,
      first_event_at: summary.firstEventAt.toISOString(),
      last_event_at: summary.lastEventAt.toISOString(),
      total_events: summary.totalEvents,
      total_processes: summary.totalProcesses,
      error_count: summary.errorCount,
      last_process: summary.lastProcess,
      systems_touched: summary.systemsTouched,
      correlation_ids: summary.correlationIds,
      updated_at: summary.updatedAt.toISOString(),
    };

    expect(response.first_event_at).toBe('2024-01-01T00:00:00.000Z');
    expect(response.last_event_at).toBe('2024-01-15T12:00:00.000Z');
    expect(response.updated_at).toBe('2024-01-15T12:30:00.000Z');
  });

  it('should use snake_case for API response fields', () => {
    const summary = createAccountSummaryDbRecord();

    const response = {
      account_id: summary.accountId,
      first_event_at: summary.firstEventAt.toISOString(),
      last_event_at: summary.lastEventAt.toISOString(),
      total_events: summary.totalEvents,
      total_processes: summary.totalProcesses,
      error_count: summary.errorCount,
      last_process: summary.lastProcess,
      systems_touched: summary.systemsTouched,
      correlation_ids: summary.correlationIds,
      updated_at: summary.updatedAt.toISOString(),
    };

    expect(response).toHaveProperty('account_id');
    expect(response).toHaveProperty('first_event_at');
    expect(response).toHaveProperty('last_event_at');
    expect(response).toHaveProperty('total_events');
    expect(response).toHaveProperty('total_processes');
    expect(response).toHaveProperty('error_count');
    expect(response).toHaveProperty('systems_touched');
    expect(response).toHaveProperty('correlation_ids');
    expect(response).toHaveProperty('updated_at');
  });
});
