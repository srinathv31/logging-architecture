---
name: new-api-test
description: Scaffold tests for an API route or service with mocks, fixtures, and the test app factory. Use this skill when writing tests for Fastify routes or service functions.
user-invokable: true
argument-hint: "Domain/resource name to test"
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Create an API Test

Write tests for the specified route or service using the project's testing patterns.

## Route Integration Test

Create `api/test/routes/<domain>/<action>.test.ts`:

### 1. Set Up Mocks Before Imports

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { mockEventLogService, resetAllMocks } from '../../mocks/services';
import { createEventFixture, createEventLogDbRecord } from '../../fixtures/events';

// Mock the service BEFORE app import (vi.mock is hoisted)
vi.mock('../../../src/services/event-log.service', () => mockEventLogService);
```

### 2. Use the Test App Factory

```typescript
import { createTestApp, closeTestApp } from '../../helpers/app';

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await closeTestApp(app); });
beforeEach(() => { resetAllMocks(); });
```

### 3. Test with `app.inject()`

```typescript
it('creates an event', async () => {
  const fixture = createEventFixture({ processName: 'TEST_PROCESS' });

  const response = await app.inject({
    method: 'POST',
    url: '/v1/events',
    payload: fixture,
  });

  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.payload);
  expect(body.success).toBe(true);
});

it('returns 400 for invalid input', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/events',
    payload: { /* missing required fields */ },
  });

  expect(response.statusCode).toBe(400);
});
```

## Service Unit Test

Create `api/test/services/<name>.service.test.ts`:

### 1. Set Up Drizzle Mock

```typescript
import { createDrizzleMock, createMockDbModule } from '../mocks/drizzle';

const mockDb = createDrizzleMock();
vi.mock('../../src/db/client', () => createMockDbModule(mockDb));

beforeEach(() => { mockDb._reset(); });
```

### 2. Test Service Functions

```typescript
import { getByAccount } from '../../src/services/event-log.service';

it('returns paginated results', async () => {
  const record = createEventLogDbRecord({ _totalCount: 5 });
  mockDb._setQueryResult([record]);

  const result = await getByAccount('acct-1', { page: 1, pageSize: 20 });

  expect(result.events).toHaveLength(1);
  expect(result.totalCount).toBe(5);
  expect(result.hasMore).toBe(false);
});
```

## Fixture Factory

If new fixtures are needed, add to `api/test/fixtures/`:

```typescript
export function createMyFixture(overrides: Partial<MyType> = {}): MyType {
  return {
    // sensible defaults for all required fields
    ...overrides,
  };
}
```

## Checklist

- [ ] `vi.mock()` calls are before dynamic imports
- [ ] `resetAllMocks()` / `mockDb._reset()` in `beforeEach`
- [ ] `createTestApp()` in `beforeAll`, `closeTestApp()` in `afterAll`
- [ ] Uses `app.inject()` (not `fetch` or real HTTP)
- [ ] Tests both success and error paths
- [ ] Fixtures use factory functions with `Partial<T>` overrides
