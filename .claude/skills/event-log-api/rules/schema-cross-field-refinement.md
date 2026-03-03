---
title: Cross-Field Validation with superRefine
impact: MEDIUM
impactDescription: Validating cross-field logic in route handlers bypasses Fastify's automatic error responses and scatters validation across the codebase
tags: zod, superRefine, cross-field, validation
---

## Cross-Field Validation with superRefine

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
