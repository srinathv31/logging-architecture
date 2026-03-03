---
title: Date Field Preprocessing for JSON Serialization
impact: HIGH
impactDescription: Using z.date() in response schemas causes JSON serialization failures since Date objects are not valid JSON
tags: zod, date, preprocessing, json, serialization
---

## Date Field Preprocessing for JSON Serialization

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
