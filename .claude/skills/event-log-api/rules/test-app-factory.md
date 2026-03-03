---
title: Test App Factory Pattern
impact: HIGH
impactDescription: ensures tests run fast without database dependencies
tags: test, vitest, fastify, factory, mock
---

## Test App Factory Pattern

Use `createTestApp()` with dynamic import to load `buildApp()` without triggering the database module. This allows route integration tests to run entirely in-process without a real database connection.

**Incorrect (starting a real database connection or importing app at top-level):**

```typescript
// BAD: top-level import triggers db module side effects
import { buildApp } from '../../src/app';
import { db } from '../../src/db/client';

const app = buildApp();

it('creates an event', async () => {
  // This requires a real database connection
  const response = await fetch('http://localhost:8080/v1/events', {
    method: 'POST',
    body: JSON.stringify(fixture),
  });
});
```

**Correct (dynamic import with createTestApp helper, based on api/test/helpers/app.ts):**

```typescript
import type { FastifyInstance } from 'fastify';

export async function createTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import('../../src/app');
  const app = buildApp();
  await app.ready();
  return app;
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
}
```

Usage in tests:

```typescript
let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await closeTestApp(app); });

it('creates an event', async () => {
  const response = await app.inject({ method: 'POST', url: '/v1/events', payload: fixture });
  expect(response.statusCode).toBe(201);
});
```

- The dynamic `import()` ensures `vi.mock()` calls in the test file are registered before the app module (and its transitive dependencies) are loaded.
- `app.inject()` performs in-process HTTP testing with no real server or network needed.
- Always call `closeTestApp()` in `afterAll` to clean up Fastify resources.
