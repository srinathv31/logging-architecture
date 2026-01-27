---
title: typeof Type Guards
impact: CRITICAL
impactDescription: enables safe narrowing for primitive types
tags: narrowing, typeof, primitives, type-guards
---

## typeof Type Guards

Use `typeof` to narrow union types containing primitives. TypeScript understands `typeof` checks and narrows the type in the corresponding branch.

**Incorrect (no narrowing, unsafe access):**

```typescript
function process(value: string | number) {
  // Error: toUpperCase doesn't exist on number
  return value.toUpperCase();
}

function handle(value: string | null) {
  // typeof null returns "object", not "null"!
  if (typeof value === "object") {
    // value is still string | null here - not narrowed to null
    console.log(value.length); // Runtime error if null
  }
}
```

**Correct (typeof narrowing):**

```typescript
function process(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase(); // value is string
  }
  return value.toFixed(2); // value is number
}

function handle(value: string | null) {
  // Use strict equality for null check
  if (value === null) {
    return "No value";
  }
  return value.toUpperCase(); // value is string
}
```

**typeof return values:**

| Type | typeof result |
|------|---------------|
| string | "string" |
| number | "number" |
| boolean | "boolean" |
| undefined | "undefined" |
| symbol | "symbol" |
| bigint | "bigint" |
| function | "function" |
| null | "object" (historical bug) |
| object/array | "object" |

Always use strict equality (`===`) with `null` instead of `typeof` for null checks.
