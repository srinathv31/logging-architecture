---
title: Zod Schema Validation Patterns
impact: CRITICAL
impactDescription: Schemas without proper constraints allow invalid data into the database, causing data integrity failures
tags: zod, validation, schema, request
---

## Zod Schema Validation Patterns

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
