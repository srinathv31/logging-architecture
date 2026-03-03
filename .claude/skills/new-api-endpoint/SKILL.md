---
name: new-api-endpoint
description: Scaffold a new Fastify API endpoint with schema, route, service, and registration. Use this skill when creating a new REST resource in the Event Log API.
user-invokable: true
argument-hint: "Resource name for the new endpoint"
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Create a New API Endpoint

Scaffold a complete REST endpoint for the given resource name.

## Step 1: Create the Zod Schema

Create `api/src/schemas/<resource>.ts`:

- Define request schema with proper constraints (`.min()`, `.max()`, `.regex()` on strings)
- Define response schema using `dateField` preprocessor for any Date columns
- For list endpoints, compose with `paginationQuerySchema.merge(dateRangeQuerySchema).extend({...})`
- Use `z.coerce` for query string parameters
- Export all schemas as named exports

```typescript
import { z } from 'zod';
import { paginationQuerySchema, dateRangeQuerySchema, dateField } from './common';

export const create<Resource>Schema = z.object({
  // request fields with constraints
});

export const <resource>ResponseSchema = z.object({
  // response fields, use dateField for timestamps
});

export const list<Resource>QuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    // endpoint-specific filters
  });

export const list<Resource>ResponseSchema = z.object({
  items: z.array(<resource>ResponseSchema),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});
```

## Step 2: Create the Service

Create `api/src/services/<resource>.service.ts`:

- Use named function exports (no classes)
- Each function calls `const db = await getDb()`
- Use `count(*) over()` window function for paginated queries
- Use `.fetch()` instead of `.limit()` for MSSQL
- Throw `AppError` subclasses for error cases

## Step 3: Create the Route

Create `api/src/routes/<resource>/create.ts` (and `list.ts`, etc.):

- Use `app.withTypeProvider<ZodTypeProvider>()`
- Include `tags`, `description`, `body`/`querystring`, and `response` in schema
- Import service as namespace: `import * as <resource>Service from '../../services/...'`
- No try/catch — centralized error handler covers all cases

## Step 4: Create the Domain Index

Create `api/src/routes/<resource>/index.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { createRoutes } from './create';
import { listRoutes } from './list';

export async function <resource>Routes(app: FastifyInstance) {
  app.register(createRoutes);
  app.register(listRoutes);
}
```

## Step 5: Register in Routes Index

Add to `api/src/routes/index.ts`:

```typescript
import { <resource>Routes } from './<resource>/index';

app.register(<resource>Routes, { prefix: '/<resource>' });
```

## Checklist

- [ ] Schema has `.min()` / `.max()` on all strings
- [ ] Query params use `z.coerce` for numbers
- [ ] Response dates use `dateField` preprocessor
- [ ] Service uses `const db = await getDb()` per function
- [ ] Paginated queries use `count(*) over()` window function
- [ ] Route uses `withTypeProvider<ZodTypeProvider>()`
- [ ] Route registered with correct prefix hierarchy
- [ ] Paginated response includes `{ items, totalCount, page, pageSize, hasMore }`
