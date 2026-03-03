---
name: event-log-api
description: Fastify REST API patterns for the Event Log API. Apply when adding endpoints, modifying services, writing tests, or querying the database in the api/ directory. Triggers on tasks involving route creation, schema validation, service layer changes, error handling, or test writing in the Fastify API codebase.
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Event Log API Patterns

Comprehensive guide for building Fastify REST API routes, Zod schemas, services, error handling, and tests in the Event Log API codebase. Contains 19 rules across 6 categories.

## When to Apply

Reference these guidelines when:
- Adding new Fastify route handlers in `api/src/routes/`
- Defining Zod request/response schemas in `api/src/schemas/`
- Writing service layer functions in `api/src/services/`
- Implementing error handling or custom error classes
- Writing vitest tests for routes or services
- Configuring environment variables with Zod validation

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Route Definition | CRITICAL | `route-` |
| 2 | Schema Validation | CRITICAL/HIGH | `schema-` |
| 3 | Service Layer | HIGH | `service-` |
| 4 | Error Handling | HIGH/MEDIUM | `error-` |
| 5 | Testing Patterns | HIGH/MEDIUM | `test-` |
| 6 | API Conventions | MEDIUM | `response-`/`env-` |

## Quick Reference

### 1. Route Definition (CRITICAL)

- `route-definition` - Fastify route with ZodTypeProvider, schema object structure
- `route-registration` - Modular route files, prefix nesting, routes/index.ts

### 2. Schema Validation (CRITICAL/HIGH)

- `schema-zod-validation` - Core Zod patterns (z.object, regex, enum, optional)
- `schema-date-preprocessing` - Date→ISO string preprocessor for JSON responses
- `schema-enum-patterns` - as const + tuple extraction for z.enum()
- `schema-pagination` - Reusable pagination/dateRange schemas, .merge()
- `schema-cross-field-refinement` - .superRefine() for cross-field validation

### 3. Service Layer (HIGH)

- `service-layer-structure` - Module-level exports, getDb(), no classes
- `service-chunked-batch-insert` - chunkArray + transaction + per-chunk fallback
- `service-pagination-window` - count(*) over() window function pattern

### 4. Error Handling (HIGH/MEDIUM)

- `error-apperror-hierarchy` - AppError/NotFoundError/ConflictError
- `error-handler-plugin` - Centralized setErrorHandler (Zod, AppError, MSSQL)
- `error-mssql-constraints` - Error 2627/2601 → 409 Conflict mapping

### 5. Testing Patterns (HIGH/MEDIUM)

- `test-app-factory` - buildTestApp() without DB, mock services
- `test-service-mock` - Centralized vi.fn() mocks with resetAllMocks
- `test-drizzle-mock` - Chainable Drizzle mock builder
- `test-fixture-factory` - Factory functions with partial overrides

### 6. API Conventions (MEDIUM)

- `response-format` - Consistent {items, totalCount, page, pageSize, hasMore}
- `env-zod-config` - Zod-validated env vars, safeParse, fail-fast

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/route-definition.md
rules/schema-zod-validation.md
rules/service-layer-structure.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and variations

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
