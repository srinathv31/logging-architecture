---
title: Test Fixture Factory Pattern
impact: MEDIUM
impactDescription: provides consistent test data with easy customization
tags: test, fixture, factory, overrides
---

## Test Fixture Factory Pattern

Define factory functions that return complete, valid objects with sensible defaults. Accept `Partial<T>` overrides via object spread so tests only specify the fields they care about.

**Incorrect (inline test data in every test, incomplete objects, copy-pasting fixtures):**

```typescript
// BAD: duplicated, incomplete, and brittle
it('test 1', async () => {
  const event = { correlationId: 'abc', accountId: 'acct-1' }; // missing required fields
  // ...
});

it('test 2', async () => {
  const event = { correlationId: 'abc', accountId: 'acct-1', traceId: '...' }; // copy-pasted
  // ...
});
```

**Correct (factory with defaults and overrides, based on api/test/fixtures/events.ts):**

```typescript
import type { EventLogEntry } from '../../src/types/api';

export function createEventFixture(overrides: Partial<EventLogEntry> = {}): EventLogEntry {
  return {
    correlationId: 'test-correlation-id',
    accountId: 'test-account-id',
    traceId: 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8',
    spanId: 'a1b2c3d4e5f6a7b8',
    applicationId: 'test-app',
    targetSystem: 'test-target',
    originatingSystem: 'test-origin',
    processName: 'test-process',
    eventType: 'PROCESS_START',
    eventStatus: 'SUCCESS',
    identifiers: { test_id: 'test-123' },
    summary: 'Test event summary',
    result: 'Test result',
    eventTimestamp: new Date().toISOString(),
    ...overrides,
  };
}

// DB record factory (includes auto-generated fields)
export function createEventLogDbRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    eventLogId: 1,
    executionId: 'test-execution-id',
    correlationId: 'test-correlation-id',
    // ... all columns with defaults
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
```

Usage:

```typescript
createEventFixture({ eventStatus: 'FAILURE', processName: 'custom-process' })
```

- Every factory returns a fully valid object by default, so tests that do not care about specific fields can call it with no arguments.
- The `...overrides` spread at the end lets any field be customized per test.
- Maintain separate factories for API-level types (`createEventFixture`) and database-level records (`createEventLogDbRecord`) since they have different shapes.
- When a new required field is added to a type, update the factory in one place rather than fixing every test file.
