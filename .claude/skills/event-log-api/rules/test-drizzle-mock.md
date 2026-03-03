---
title: Chainable Drizzle Mock Pattern
impact: MEDIUM
impactDescription: enables service unit testing without a real database
tags: test, vitest, drizzle, mock, chainable
---

## Chainable Drizzle Mock Pattern

Build a chainable mock that replicates Drizzle's query builder pattern (`select().from().where().orderBy().offset().fetch()`). This supports MSSQL-specific patterns like `.top()` and `insert().output().values()`, allowing service-layer unit tests to run without any database.

**Incorrect (mocking individual drizzle methods without chaining support):**

```typescript
// BAD: does not replicate Drizzle's chained API
const mockDb = {
  select: vi.fn().mockResolvedValue([{ id: 1 }]),
  insert: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
};
// Service calls db.select().from().where() — this will throw
```

**Correct (chainable mock builder, based on api/test/mocks/drizzle.ts):**

```typescript
import { vi } from 'vitest';

export function createDrizzleMock() {
  let queryResult: unknown[] = [];
  let insertResult: unknown[] = [{ executionId: 'test-execution-id' }];

  const mock = {
    select: vi.fn().mockImplementation((...args) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              fetch: vi.fn().mockResolvedValue(queryResult),
            }),
          }),
        }),
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      output: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(insertResult),
      }),
    })),
    transaction: vi.fn().mockImplementation(async (cb) => cb(mock)),
    // Test helpers
    _setQueryResult: (result: unknown[]) => { queryResult = result; },
    _setInsertResult: (result: unknown[]) => { insertResult = result; },
    _reset: () => { queryResult = []; insertResult = [{ executionId: 'test-execution-id' }]; },
  };
  return mock;
}

export function createMockDbModule(mockDb) {
  return { db: mockDb, getDb: vi.fn().mockResolvedValue(mockDb), closeDb: vi.fn() };
}
```

Usage:

```typescript
const mockDb = createDrizzleMock();
vi.mock('../../src/db/client', () => createMockDbModule(mockDb));

beforeEach(() => { mockDb._reset(); });

it('queries events', async () => {
  mockDb._setQueryResult([{ ...eventFixture, _totalCount: 1 }]);
  const result = await getByAccount('acct-1', { page: 1, pageSize: 20 });
  expect(result.events).toHaveLength(1);
});
```

- The `_setQueryResult` and `_setInsertResult` helpers let each test configure exactly the data it needs.
- `_reset()` in `beforeEach` ensures clean state between tests.
- `transaction` passes the mock itself to the callback, so transactional service code works without modification.
- Extend the chain as new Drizzle methods are used in the service layer (e.g., `.leftJoin()`, `.groupBy()`).
