---
title: Centralized Service Mock Pattern
impact: HIGH
impactDescription: enables route testing without database dependencies
tags: test, vitest, mock, service, vi.fn
---

## Centralized Service Mock Pattern

Define centralized service mock objects with `vi.fn()` for each method in a shared mock file. Use `resetAllMocks()` to clear call history between tests. Wire up mocks with `vi.mock()` in each test file.

**Incorrect (creating mocks inline in each test file, not clearing between tests):**

```typescript
// BAD: duplicated mock definitions, no reset between tests
it('test 1', async () => {
  const mockService = { createEvent: vi.fn().mockResolvedValue(someData) };
  // ...
});

it('test 2', async () => {
  // Previous mock state leaks into this test
  const mockService = { createEvent: vi.fn().mockResolvedValue(otherData) };
  // ...
});
```

**Correct (centralized mock with reset, based on api/test/mocks/services.ts):**

```typescript
import { vi } from 'vitest';
import { createEventLogDbRecord } from '../fixtures/events';

export const mockEventLogService = {
  createEvent: vi.fn().mockResolvedValue(createEventLogDbRecord()),
  createEvents: vi.fn().mockResolvedValue({ executionIds: ['exec-1'], correlationIds: ['corr-1'], errors: [] }),
  getByAccount: vi.fn().mockResolvedValue({ events: [createEventLogDbRecord()], totalCount: 1, hasMore: false }),
};

export function resetAllMocks() {
  Object.values(mockEventLogService).forEach((mock) => mock.mockClear());
}
```

Wire up with `vi.mock()` in test files:

```typescript
import { mockEventLogService, resetAllMocks } from '../mocks/services';

vi.mock('../../src/services/event-log.service', () => mockEventLogService);

beforeEach(() => { resetAllMocks(); });
```

- Centralizing mocks in `api/test/mocks/services.ts` avoids duplication and drift across test files.
- `mockClear()` resets call history and return values without removing the mock implementation.
- Always call `resetAllMocks()` in `beforeEach` so each test starts with a clean slate.
- Add new service methods to the centralized mock as the service layer grows.
