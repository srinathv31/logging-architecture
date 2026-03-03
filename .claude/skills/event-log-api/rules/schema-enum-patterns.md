---
title: Enum Definition with Const Objects and Zod
impact: HIGH
impactDescription: Incorrect enum patterns cause z.enum() type errors or lose type narrowing in switch statements
tags: zod, enum, typescript, const
---

## Enum Definition with Const Objects and Zod

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
