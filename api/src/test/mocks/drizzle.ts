/**
 * Chainable Drizzle ORM mock builder for unit testing services.
 *
 * This mock replicates Drizzle's query builder pattern to allow testing
 * service code without a real database connection.
 */
import { vi, type Mock } from 'vitest';

export interface DrizzleMock {
  // Query methods - return this for chaining
  select: Mock;
  from: Mock;
  where: Mock;
  orderBy: Mock;
  offset: Mock;
  top: Mock;
  fetch: Mock;
  selectDistinct: Mock;

  // Insert chain
  insert: Mock;
  values: Mock;
  output: Mock;

  // Other operations
  delete: Mock;
  execute: Mock;

  // Transaction support
  transaction: Mock;

  // Test helpers - prefixed with _ to indicate internal use
  _setQueryResult: (result: unknown[]) => void;
  _setInsertResult: (result: unknown[]) => void;
  _setCountResult: (count: number) => void;
  _setTopResult: (result: unknown[]) => void;
  _setSelectDistinctResult: (result: unknown[]) => void;
  _setFetchResults: (results: unknown[][]) => void;
  _reset: () => void;
  _getCallHistory: () => {
    select: unknown[][];
    insert: unknown[][];
    delete: unknown[][];
    execute: unknown[][];
  };
}

export function createDrizzleMock(): DrizzleMock {
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

  // Create the chainable mock
  const chainableMock: DrizzleMock = {
    // Query methods - most return this for chaining
    select: vi.fn().mockImplementation((...args: unknown[]) => {
      callHistory.select.push(args);
      // Check if this is a count select (has 'count' in the fields object)
      if (args[0] && typeof args[0] === 'object' && 'count' in (args[0] as object)) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([countResult]),
          }),
        };
      }
      // Return chainable mock for select().top() or select().from() patterns
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
    }),

    from: vi.fn().mockReturnThis(),

    where: vi.fn().mockImplementation(() => {
      // Return the mock for chaining, but also resolve as an array for terminal calls
      const result = Object.create(chainableMock);
      result.then = (resolve: (value: unknown) => void) => resolve(queryResult);
      result.catch = () => result;
      return result;
    }),

    orderBy: vi.fn().mockReturnThis(),

    offset: vi.fn().mockReturnThis(),

    top: vi.fn().mockImplementation(() => {
      // top().from().where() pattern for MSSQL
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(topResult),
        }),
      };
    }),

    fetch: vi.fn().mockImplementation(() => {
      const result = fetchResults.length > 0 ? fetchResults[fetchCallCount] || queryResult : queryResult;
      fetchCallCount++;
      return Promise.resolve(result);
    }),

    selectDistinct: vi.fn().mockImplementation(() => {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(selectDistinctResult),
        }),
      };
    }),

    // Insert chain - MSSQL specific: insert().output().values()
    insert: vi.fn().mockImplementation((...args: unknown[]) => {
      callHistory.insert.push(args);
      return {
        output: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(() => Promise.resolve(insertResult)),
        }),
        values: vi.fn().mockResolvedValue(undefined),
      };
    }),

    values: vi.fn().mockReturnThis(),

    output: vi.fn().mockImplementation(() => Promise.resolve(insertResult)),

    // Delete
    delete: vi.fn().mockImplementation((...args: unknown[]) => {
      callHistory.delete.push(args);
      return Promise.resolve();
    }),

    // Execute raw SQL
    execute: vi.fn().mockImplementation((...args: unknown[]) => {
      callHistory.execute.push(args);
      return Promise.resolve();
    }),

    // Transaction support
    transaction: vi.fn().mockImplementation(async (callback: (tx: DrizzleMock) => Promise<void>) => {
      return callback(chainableMock);
    }),

    // Test helpers
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

    _setSelectDistinctResult: (result: unknown[]) => {
      selectDistinctResult = result;
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
      selectDistinctResult = [];
      fetchResults = [];
      fetchCallCount = 0;
      callHistory.select = [];
      callHistory.insert = [];
      callHistory.delete = [];
      callHistory.execute = [];

      // Clear all mock call history
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

      chainableMock.transaction.mockImplementation(async (callback: (tx: DrizzleMock) => Promise<void>) => {
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

  return chainableMock;
}

/**
 * Creates a mock module for vi.mock('../../db/client').
 * Use with vi.hoisted() to ensure the mock is available before module loading.
 */
export function createMockDbModule(mockDb: DrizzleMock) {
  return {
    db: mockDb,
    initializeDb: vi.fn(),
    closeDb: vi.fn(),
  };
}

// Singleton instance for use across tests
export const mockDb = createDrizzleMock();
