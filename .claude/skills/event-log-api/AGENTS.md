# Event Log API Patterns - Complete Guide

> This document is mainly for agents and LLMs. For the overview and quick reference, see `SKILL.md`.

## Abstract

This guide codifies every architectural pattern, validation strategy, error-handling convention, and testing practice used in the Event Log API -- a Fastify v5 + TypeScript + Drizzle ORM application targeting MSSQL on Azure. Each section is a self-contained rule with impact level, incorrect/correct examples, and rationale. Following these patterns ensures compile-time type safety between Zod schemas and route handlers, consistent request validation, reliable batch operations, uniform error responses, and fast deterministic tests that run without a database.

## Table of Contents

1. [Route Definition with Zod Type Provider](#1-route-definition-with-zod-type-provider)
2. [Route Registration with Prefix Hierarchy](#2-route-registration-with-prefix-hierarchy)
3. [Zod Schema Validation Patterns](#3-zod-schema-validation-patterns)
4. [Date Field Preprocessing for JSON Serialization](#4-date-field-preprocessing-for-json-serialization)
5. [Enum Definition with Const Objects and Zod](#5-enum-definition-with-const-objects-and-zod)
6. [Reusable Pagination and Date Range Schemas](#6-reusable-pagination-and-date-range-schemas)
7. [Cross-Field Validation with superRefine](#7-cross-field-validation-with-superrefine)
8. [Service Layer Structure](#8-service-layer-structure)
9. [Chunked Batch Insert](#9-chunked-batch-insert)
10. [Pagination with Window Function](#10-pagination-with-window-function)
11. [AppError Class Hierarchy](#11-apperror-class-hierarchy)
12. [Centralized Error Handler Plugin](#12-centralized-error-handler-plugin)
13. [MSSQL Constraint Violation Handling](#13-mssql-constraint-violation-handling)
14. [Test App Factory Pattern](#14-test-app-factory-pattern)
15. [Centralized Service Mock Pattern](#15-centralized-service-mock-pattern)
16. [Chainable Drizzle Mock Pattern](#16-chainable-drizzle-mock-pattern)
17. [Test Fixture Factory Pattern](#17-test-fixture-factory-pattern)
18. [Paginated Response Format Convention](#18-paginated-response-format-convention)
19. [Environment Variable Validation with Zod](#19-environment-variable-validation-with-zod)

---

## 1. Route Definition with Zod Type Provider

**Impact: CRITICAL** - Routes without type provider lose compile-time safety between schema and handler, causing runtime type mismatches

Every route must use the Zod type provider to ensure request and response types are inferred directly from Zod schemas. Export an async function that takes `FastifyInstance`, call `.withTypeProvider<ZodTypeProvider>()`, and register the HTTP method with a `schema` object containing `tags`, `description`, `body`/`querystring`, and `response`.

**Incorrect (no type provider, inline validation, missing schema object):**

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function createEventRoutes(app: FastifyInstance) {
  // No type provider - request.body is 'unknown'
  app.post('/', async (request, reply) => {
    // Manual validation in the handler - error-prone, no type inference
    const parsed = z.object({
      correlationId: z.string(),
      eventType: z.string(),
    }).parse(request.body);

    const result = await eventLogService.createEvent(parsed);
    return reply.send({ success: true });
  });
}
```

**Correct (type provider with full schema registration):**

```typescript
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eventLogEntrySchema, createEventResponseSchema } from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function createEventRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post('/', {
    schema: {
      tags: ['Events'],
      description: 'Create a single event log entry',
      body: eventLogEntrySchema,
      response: { 201: createEventResponseSchema },
    },
  }, async (request, reply) => {
    const event = request.body;
    const result = await eventLogService.createEvent(event);
    return reply.status(201).send({
      success: true,
      executionIds: [result.executionId],
      correlationId: event.correlationId,
    });
  });
}
```

With the type provider in place, `request.body` is fully typed from `eventLogEntrySchema` -- no manual parsing or type assertions needed. The `schema.response` object also validates outgoing data and generates accurate Swagger documentation via `@fastify/swagger`.

---

## 2. Route Registration with Prefix Hierarchy

**Impact: CRITICAL** - Incorrect route registration breaks the API URL structure and prevents proper route encapsulation

Each domain has its own directory under `routes/`. A central `routes/index.ts` imports and registers all domain routes with their prefixes. The top-level `app.ts` registers the combined routes under the `/v1` prefix, producing URLs like `/v1/events`, `/v1/traces`.

**Incorrect (routes registered directly in app.ts, no prefix hierarchy):**

```typescript
// app.ts - DO NOT register routes directly here
import { createEventRoutes } from './routes/events/create';
import { listTracesRoutes } from './routes/traces/list';

const app = fastify();

// Flat registration with hardcoded paths - breaks encapsulation
createEventRoutes(app);
listTracesRoutes(app);
```

**Correct (hierarchical registration via routes/index.ts):**

```typescript
// routes/index.ts
import type { FastifyInstance } from 'fastify';
import { eventRoutes } from './events/index';
import { traceRoutes } from './traces/index';

export async function registerRoutes(app: FastifyInstance) {
  app.register(eventRoutes, { prefix: '/events' });
  app.register(traceRoutes, { prefix: '/traces' });
}
```

```typescript
// app.ts - single registration point with version prefix
app.register(registerRoutes, { prefix: '/v1' });
```

```typescript
// routes/events/index.ts - domain-level aggregation
import type { FastifyInstance } from 'fastify';
import { createEventRoutes } from './create';
import { batchCreateRoutes } from './batch-create';

export async function eventRoutes(app: FastifyInstance) {
  app.register(createEventRoutes);
  app.register(batchCreateRoutes);
}
```

Each domain directory (`events/`, `traces/`) has its own `index.ts` that aggregates sub-routes. This keeps route files small and focused on a single endpoint, while the prefix hierarchy automatically composes the full URL path. Adding a new domain only requires creating a new directory and a single line in `routes/index.ts`.

---

## 3. Zod Schema Validation Patterns

**Impact: CRITICAL** - Schemas without proper constraints allow invalid data into the database, causing data integrity failures

Use `z.object()` for all request schemas. Every string field must have length constraints via `.min()` and `.max()`. Use `.regex()` for format validation, `z.enum()` for constrained string sets, and `.optional()`/`.nullish()` for non-required fields.

**Incorrect (TypeScript interfaces for validation, unconstrained strings):**

```typescript
// TypeScript interfaces provide NO runtime validation
interface EventLogEntry {
  correlationId: string;
  traceId: string;
  eventType: string;       // accepts any string
  eventStatus: string;     // accepts any string
  summary: string;         // no length limit - could be megabytes
  httpStatusCode?: number; // no range check
}
```

**Correct (Zod schemas with full constraints):**

```typescript
import { z } from 'zod';
import { EVENT_TYPES, EVENT_STATUSES } from '../types/enums';

export const eventLogEntrySchema = z.object({
  correlationId: z.string().min(1).max(200),
  accountId: z.string().max(64).nullish(),
  traceId: z.string().regex(/^[0-9a-f]{32}$/, 'Must be 32 lowercase hex characters'),
  spanId: z.string().regex(/^[0-9a-f]{16}$/, 'Must be 16 lowercase hex characters').optional(),
  eventType: z.enum(EVENT_TYPES),
  eventStatus: z.enum(EVENT_STATUSES),
  identifiers: z.record(z.unknown()),
  summary: z.string().min(1),
  eventTimestamp: z.string().datetime({ offset: true }),
  executionTimeMs: z.number().int().min(0).optional(),
  httpStatusCode: z.number().int().min(100).max(599).optional(),
});
```

Key patterns to follow:

- **`.min(1)`** on required strings prevents empty string submissions
- **`.max(N)`** on all strings prevents oversized payloads and matches database column limits
- **`.regex()`** for structured formats like trace IDs and span IDs (OpenTelemetry hex format)
- **`z.enum()`** with const arrays for constrained values (see the enum patterns rule)
- **`.nullish()`** when a field can be `null` or `undefined` (vs `.optional()` for `undefined` only)
- **`z.string().datetime({ offset: true })`** for ISO 8601 timestamps with timezone offset
- **`z.number().int().min(0)`** for numeric fields that must be non-negative integers
- **`z.record(z.unknown())`** for flexible key-value objects like identifiers

---

## 4. Date Field Preprocessing for JSON Serialization

**Impact: HIGH** - Using z.date() in response schemas causes JSON serialization failures since Date objects are not valid JSON

Drizzle ORM returns JavaScript `Date` objects for timestamp columns, but JSON responses require ISO 8601 strings. Use `z.preprocess()` to handle the conversion transparently in response schemas.

**Incorrect (z.date() in response schemas fails JSON serialization):**

```typescript
// This will fail Fastify's response validation because
// JSON.stringify(new Date()) produces a string, but z.date() expects a Date object
export const traceResponseSchema = z.object({
  traceId: z.string(),
  createdAt: z.date(),         // FAILS: JSON serialization converts Date to string
  eventTimestamp: z.date(),    // FAILS: same problem
});
```

**Correct (z.preprocess() converts Date objects to ISO strings):**

```typescript
// common.ts - define a reusable date field
export const dateField = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString() : val),
  z.string(),
);

// Usage in response schemas
export const traceResponseSchema = z.object({
  traceId: z.string(),
  createdAt: dateField,
  eventTimestamp: dateField,
});

export const eventResponseSchema = z.object({
  executionId: z.string(),
  eventTimestamp: dateField,
  createdAt: dateField,
  updatedAt: dateField,
});
```

The `dateField` preprocessor handles both cases: when the value is a `Date` object (from Drizzle query results), it converts to an ISO string; when it is already a string (e.g., in test fixtures or forwarded responses), it passes through unchanged. This keeps the conversion logic in one place and ensures all date fields in API responses are consistently formatted as ISO 8601 strings.

---

## 5. Enum Definition with Const Objects and Zod

**Impact: HIGH** - Incorrect enum patterns cause z.enum() type errors or lose type narrowing in switch statements

Define enums as `as const` objects to get both runtime values and TypeScript type narrowing. Extract the values as a non-empty tuple type for use with `z.enum()`.

**Incorrect (string literals directly in z.enum, or TypeScript enums):**

```typescript
// TypeScript enums create opaque types that don't play well with Zod
enum EventStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  IN_PROGRESS = 'IN_PROGRESS',
}

// Inline strings - no reusable type, easy to typo
const schema = z.object({
  eventStatus: z.enum(['SUCCESS', 'FAILURE', 'IN_PROGRESS']),
});

// Object.values() returns string[] - z.enum() rejects it (needs non-empty tuple)
const statuses = Object.values(EventStatus);
const schema2 = z.object({
  eventStatus: z.enum(statuses), // Type error: string[] is not [string, ...string[]]
});
```

**Correct (as const object with tuple cast):**

```typescript
// types/enums.ts
export const EventStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  IN_PROGRESS: 'IN_PROGRESS',
} as const;

// Derive the union type from the object values
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

// Cast to non-empty tuple for z.enum() compatibility
export const EVENT_STATUSES = Object.values(EventStatus) as [EventStatus, ...EventStatus[]];

// Same pattern for EventType
export const EventType = {
  API_CALL: 'API_CALL',
  DB_QUERY: 'DB_QUERY',
  QUEUE_MESSAGE: 'QUEUE_MESSAGE',
  SCHEDULED_TASK: 'SCHEDULED_TASK',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EVENT_TYPES = Object.values(EventType) as [EventType, ...EventType[]];
```

```typescript
// Usage in schemas
import { EVENT_TYPES, EVENT_STATUSES } from '../types/enums';

export const eventLogEntrySchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  eventStatus: z.enum(EVENT_STATUSES),
});
```

The tuple cast `as [T, ...T[]]` is required because `Object.values()` returns `T[]`, but `z.enum()` requires a non-empty array type `[string, ...string[]]` to guarantee at least one value exists. This pattern gives you runtime values for validation, a TypeScript union type for type checking, and exhaustive switch statement support -- all from a single source of truth.

---

## 6. Reusable Pagination and Date Range Schemas

**Impact: HIGH** - Duplicating pagination fields across schemas leads to inconsistent defaults and missed coercion of query string parameters

Define reusable pagination and date range schemas in `common.ts`. Use `.merge()` or `.extend()` to compose them into endpoint-specific query schemas. Always use `z.coerce` for query string parameters since HTTP delivers them as strings.

**Incorrect (repeating page/pageSize in every schema, missing coercion):**

```typescript
// traces.ts - duplicated pagination fields
export const listTracesQuerySchema = z.object({
  page: z.number().int().positive().default(1),       // FAILS: query params are strings
  pageSize: z.number().int().min(1).max(100).default(20), // FAILS: same problem
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  processName: z.string().optional(),
});

// events.ts - same fields copied again with slightly different defaults
export const listEventsQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(50).default(10), // inconsistent max/default
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});
```

**Correct (reusable schemas with z.coerce and composition):**

```typescript
// schemas/common.ts
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeQuerySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});
```

```typescript
// schemas/traces.ts - compose with .merge() and .extend()
import { paginationQuerySchema, dateRangeQuerySchema } from './common';

export const listTracesQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    processName: z.string().optional(),
    eventStatus: z.string().optional(),
  });
```

```typescript
// schemas/events.ts - same base schemas, different extensions
import { paginationQuerySchema, dateRangeQuerySchema } from './common';

export const listEventsQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    traceId: z.string().optional(),
    eventType: z.string().optional(),
  });
```

Key details:

- **`z.coerce.number()`** is essential for query string parameters because HTTP query params always arrive as strings (e.g., `?page=2` sends `"2"`, not `2`). Without coercion, Zod rejects valid requests.
- **`.default()`** provides sensible defaults when the parameter is omitted entirely.
- **`.merge()`** combines two `z.object()` schemas into one. Use it to add the date range fields.
- **`.extend()`** adds new fields to an existing schema. Use it for endpoint-specific fields.
- Centralizing pagination ensures consistent page sizes, defaults, and validation across all list endpoints.

---

## 7. Cross-Field Validation with superRefine

**Impact: MEDIUM** - Validating cross-field logic in route handlers bypasses Fastify's automatic error responses and scatters validation across the codebase

Use `.superRefine()` when validation depends on multiple fields (e.g., requiring at least one of several optional fields, or ensuring date ranges are valid). This keeps all validation in the schema layer where Fastify can return structured 400 errors automatically.

**Incorrect (cross-field validation in the route handler):**

```typescript
typedApp.post('/search', {
  schema: {
    body: z.object({
      query: z.string().min(1),
      accountId: z.string().max(64).optional(),
      processName: z.string().max(510).optional(),
      startDate: z.string().datetime({ offset: true }).optional(),
      endDate: z.string().datetime({ offset: true }).optional(),
    }),
  },
}, async (request, reply) => {
  const { accountId, processName, startDate, endDate } = request.body;

  // Validation scattered in handler - returns inconsistent error format
  if (!accountId && !processName) {
    return reply.status(400).send({ error: 'accountId or processName is required' });
  }
  if (startDate && endDate) {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    if (diff > 30 * 24 * 60 * 60 * 1000) {
      return reply.status(400).send({ error: 'Date range cannot exceed 30 days' });
    }
  }
  // ... actual logic
});
```

**Correct (cross-field validation in the schema with superRefine):**

```typescript
import { z } from 'zod';
import { dateRangeQuerySchema } from './common';

export const textSearchRequestSchema = z.object({
  query: z.string().min(1),
  accountId: z.string().max(64).optional(),
  processName: z.string().max(510).optional(),
}).merge(dateRangeQuerySchema)
  .superRefine((value, ctx) => {
    // At least one scoping field required
    if (!value.accountId && !value.processName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountId'],
        message: 'accountId or processName is required',
      });
    }

    // Date window validation
    if (value.startDate && value.endDate) {
      const start = new Date(value.startDate).getTime();
      const end = new Date(value.endDate).getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'endDate must be after startDate',
        });
      } else if (end - start > thirtyDaysMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'Date range cannot exceed 30 days',
        });
      }
    }
  });
```

By placing cross-field logic in `.superRefine()`:

- Fastify's Zod type provider returns a structured 400 response with field-level error paths automatically -- no manual `reply.status(400)` needed.
- All validation rules are co-located in the schema, making them discoverable and testable in isolation.
- The `path` array in `ctx.addIssue()` tells the client exactly which field is invalid, matching the same format as single-field validation errors.
- Multiple issues can be reported in a single pass (`.superRefine()` does not short-circuit like `.refine()`).

---

## 8. Service Layer Structure

**Impact: HIGH** - Ensures consistent service architecture across the API

Services are plain TypeScript modules with named function exports. No classes. Each function gets db via `const db = await getDb()`.

**Incorrect (class-based service with module-level db):**

```typescript
import { getDb } from '../db/client';

const db = await getDb(); // Module-level — fails if DB not ready at import time

export class EventLogService {
  async createEvent(entry: EventLogEntry) {
    const [result] = await db.insert(eventLogs).output().values(entryToInsert(entry));
    return result;
  }
}
```

**Correct (named function exports, per-call db):**

```typescript
import { getDb } from '../db/client';
import { eventLogs } from '../db/schema/index';

export async function createEvent(entry: EventLogEntry) {
  const db = await getDb();
  const [result] = await db.insert(eventLogs).output().values(entryToInsert(entry));
  return result;
}

export async function getByAccount(accountId: string, filters: {...}) {
  const db = await getDb();
  // ...query logic
}
```

Import in routes as: `import * as eventLogService from '../../services/event-log.service';`

The `getDb()` call is async because the connection may be lazy-initialized.

---

## 9. Chunked Batch Insert

**Impact: HIGH** - Prevents timeout and memory issues on large batch inserts

Chunk large arrays, wrap in transaction, use per-chunk try/catch with individual fallback for failed chunks.

**Incorrect (single insert, no error isolation):**

```typescript
export async function createEvents(entries: EventLogEntry[]) {
  const db = await getDb();
  // Single insert with all rows — timeout on large batches, one bad row fails everything
  const results = await db.insert(eventLogs).output().values(entries.map(entryToInsert));
  return { executionIds: results.map(r => r.executionId), errors: [] };
}
```

**Correct (chunked with per-row fallback):**

```typescript
import { chunkArray } from '../utils/array';

const BATCH_CHUNK_SIZE = 100;

export async function createEvents(entries: EventLogEntry[], batchId?: string) {
  const db = await getDb();
  const executionIds: (string | null)[] = new Array(entries.length).fill(null);
  const errors: Array<{ index: number; error: string }> = [];

  await db.transaction(async (tx) => {
    const chunks = chunkArray(toInsert, BATCH_CHUNK_SIZE);
    for (const chunk of chunks) {
      try {
        const results = await tx.insert(eventLogs).output({...}).values(chunk.map(c => ...));
        results.forEach((row, i) => { executionIds[chunk[i].index] = row.executionId; });
      } catch {
        // Per-row fallback for failed chunk
        for (const item of chunk) {
          try {
            const [result] = await tx.insert(eventLogs).output({...}).values({...});
            executionIds[item.index] = result.executionId;
          } catch (err) {
            errors.push({ index: item.index, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }
      }
    }
  });

  return { executionIds: executionIds.filter((id): id is string => id !== null), errors };
}
```

The per-chunk fallback ensures one bad row doesn't fail the entire batch.

---

## 10. Pagination with Window Function

**Impact: HIGH** - Enables efficient pagination without separate COUNT query

Use `count(*) over()` window function to get total count in the same query as paginated data. Helper function handles edge cases.

**Incorrect (separate COUNT query):**

```typescript
export async function getByAccount(accountId: string, filters: { page: number; pageSize: number }) {
  const db = await getDb();
  // Two separate queries — doubles database round trips
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(eventLogs).where(where);
  const rows = await db.select().from(eventLogs).where(where).limit(filters.pageSize).offset(offset);
  return { events: rows, totalCount: countRow.count };
}
```

**Correct (window function in same query):**

```typescript
// In query - add window function column
const rows = await db
  .select({
    ...getColumns(eventLogs),
    _totalCount: sql<number>`cast(count(*) over() as int)`,
  })
  .from(eventLogs)
  .where(where)
  .orderBy(desc(eventLogs.eventTimestamp))
  .offset(offset)
  .fetch(filters.pageSize);

// Helper to extract totalCount from results
async function getTotalCountFromPaginatedRows(db, where, rows, offset) {
  if (rows.length > 0) return rows[0]._totalCount;
  if (offset === 0) return 0;  // No rows + first page = empty table
  // Only run separate count if on a page beyond results
  const [countRow] = await db.select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventLogs).where(where);
  return countRow?.count ?? 0;
}

const totalCount = await getTotalCountFromPaginatedRows(db, where, rows, offset);
const hasMore = offset + filters.pageSize < totalCount;
const events = rows.map(({ _totalCount, ...event }) => event);
```

The `_totalCount` field is stripped from the response using destructuring. Uses `.fetch()` instead of `.limit()` for MSSQL compatibility (FETCH NEXT N ROWS ONLY).

---

## 11. AppError Class Hierarchy

**Impact: HIGH** - Provides consistent error handling with appropriate HTTP status codes

Base AppError class with statusCode and code. Subclasses for common HTTP errors.

**Incorrect (plain Error or inline status codes):**

```typescript
// In a service — coupling service to HTTP concerns
export async function getEvent(id: string) {
  const event = await db.select().from(eventLogs).where(eq(eventLogs.id, id));
  if (!event) {
    throw new Error('Not found'); // No status code, will become 500
  }
  return event;
}

// In a route — inconsistent error shapes
app.get('/events/:id', async (request, reply) => {
  const event = await getEvent(id);
  if (!event) {
    return reply.status(404).send({ msg: 'not found' }); // Ad-hoc shape
  }
});
```

**Correct (AppError hierarchy):**

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}
```

Throw from services: `throw new NotFoundError('Account not found')`. The error handler plugin maps these to proper HTTP responses.

---

## 12. Centralized Error Handler Plugin

**Impact: HIGH** - Ensures all errors are handled consistently across all routes

Single centralized error handler registered as a Fastify plugin. Handles Zod, AppError, Fastify validation, and MSSQL errors.

**Incorrect (try/catch in every route):**

```typescript
app.get('/events', async (request, reply) => {
  try {
    const events = await eventLogService.getEvents();
    return reply.send(events);
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: error.errors });
    }
    // Duplicated in every route, inconsistent shapes
    return reply.status(500).send({ error: 'Something went wrong' });
  }
});
```

**Correct (centralized error handler plugin):**

```typescript
import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation Error', details: error.errors });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.code ?? error.name, message: error.message });
    }
    if ('validation' in error && error.validation) {
      return reply.status(400).send({ error: 'Validation Error', details: error.validation });
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      const statusCode = error.statusCode;
      if (statusCode >= 400 && statusCode < 600) {
        return reply.status(statusCode).send({ error: error.name, message: error.message });
      }
    }
    // MSSQL unique constraint violation
    if ('number' in error && (error.number === 2627 || error.number === 2601)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Resource with given unique constraint already exists.' });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error', message: 'An unexpected error occurred.' });
  });
}
```

Registered in app.ts: `registerErrorHandler(app);`

---

## 13. MSSQL Constraint Violation Handling

**Impact: MEDIUM** - Maps database constraint violations to meaningful HTTP responses

MSSQL error numbers 2627 (unique key violation) and 2601 (unique index violation) map to 409 Conflict.

**Incorrect (letting MSSQL errors bubble as 500):**

```typescript
// No special handling — MSSQL constraint errors surface as 500 Internal Server Error
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return reply.status(500).send({ error: 'Internal Server Error' });
});
```

**Correct (mapping constraint violations to 409):**

```typescript
// In the error handler
if ('number' in error && ((error as { number?: number }).number === 2627 || (error as { number?: number }).number === 2601)) {
  return reply.status(409).send({
    error: 'Conflict',
    message: 'A resource with the given unique constraint already exists.',
  });
}
```

- Error 2627: Violation of PRIMARY KEY / UNIQUE KEY constraint
- Error 2601: Cannot insert duplicate key row with unique index
- Both indicate the client tried to create a resource that already exists

---

## 14. Test App Factory Pattern

**Impact: HIGH** - Ensures tests run fast without database dependencies

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

---

## 15. Centralized Service Mock Pattern

**Impact: HIGH** - Enables route testing without database dependencies

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

---

## 16. Chainable Drizzle Mock Pattern

**Impact: MEDIUM** - Enables service unit testing without a real database

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

---

## 17. Test Fixture Factory Pattern

**Impact: MEDIUM** - Provides consistent test data with easy customization

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

---

## 18. Paginated Response Format Convention

**Impact: MEDIUM** - Ensures consistent API response structure across all endpoints

All paginated endpoints return a consistent shape: `{ items/events/traces, totalCount, page, pageSize, hasMore }`. The collection field name matches the resource type. `hasMore` is computed server-side as `offset + pageSize < totalCount`.

**Incorrect (inconsistent response shapes, missing pagination metadata, different field names):**

```typescript
// BAD: inconsistent naming, missing fields, client must compute hasMore
return reply.send({ data: traces, total: 50 });

// BAD: different shape for different endpoints
return reply.send({ results: events, count: 10, next: '/v1/events?page=2' });
```

**Correct (consistent paginated response, based on api/src/schemas/traces.ts):**

```typescript
// Response schema
export const listTracesResponseSchema = z.object({
  traces: z.array(traceSummarySchema),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});

// In service layer
const offset = (filters.page - 1) * filters.pageSize;
const hasMore = offset + filters.pageSize < totalCount;

return { traces, totalCount, hasMore };

// In route handler
return reply.send({ traces, totalCount, page, pageSize, hasMore });
```

- The collection field name matches the resource: `events` for events, `traces` for traces, `correlationIds` for correlation IDs.
- `totalCount` is always an integer representing the full count of matching records.
- `hasMore` is computed server-side (`offset + pageSize < totalCount`) so clients do not need to compute it themselves.
- `page` and `pageSize` are echoed back in the response so clients can confirm what was requested.
- This convention applies to every paginated endpoint in the API for a uniform client experience.

---

## 19. Environment Variable Validation with Zod

**Impact: MEDIUM** - Catches misconfiguration at startup instead of runtime

Define the environment schema with Zod, use `safeParse` on `process.env`, and call `process.exit(1)` on failure with human-readable errors. This fail-fast approach catches misconfiguration at startup rather than at runtime when a request hits a broken code path.

**Incorrect (using process.env directly without validation, missing defaults):**

```typescript
// BAD: no validation, no type safety, runtime errors on missing vars
const port = parseInt(process.env.PORT); // NaN if undefined
const host = process.env.HOST; // possibly undefined
const dbPoolMax = Number(process.env.DB_POOL_MAX); // NaN if undefined

app.listen({ port, host }); // crashes or binds to wrong interface
```

**Correct (Zod schema with safeParse and fail-fast, based on api/src/config/env.ts):**

```typescript
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DB_SERVER: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().optional().default(10),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
```

- `z.coerce.number()` handles automatic string-to-number conversion, which is necessary since all `process.env` values are strings.
- `.default()` provides sensible defaults so the app works out of the box in development.
- `safeParse` + `process.exit(1)` ensures the app fails fast with a clear error message on misconfiguration.
- `result.error.flatten().fieldErrors` produces a human-readable object showing exactly which variables are invalid and why.
- Export the typed `env` object for use throughout the app instead of accessing `process.env` directly.
