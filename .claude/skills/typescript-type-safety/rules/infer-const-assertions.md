---
title: const Assertions
impact: HIGH
impactDescription: preserves literal types and creates readonly structures
tags: as-const, literal-types, readonly, inference
---

## const Assertions

Use `as const` to tell TypeScript to infer the narrowest possible type. This creates readonly structures and preserves literal types instead of widening to string/number.

**Incorrect (literals widened):**

```typescript
// Widened to string
const direction = "north";
type Direction = typeof direction; // string

// Widened to string[]
const statuses = ["pending", "active", "done"];
type Status = typeof statuses[number]; // string

// Object properties widened
const config = {
  mode: "production",
  port: 3000,
};
type Mode = typeof config.mode; // string
```

**Correct (as const preserves literals):**

```typescript
// Literal type preserved
const direction = "north" as const;
type Direction = typeof direction; // "north"

// Readonly tuple with literal types
const statuses = ["pending", "active", "done"] as const;
type Status = typeof statuses[number]; // "pending" | "active" | "done"

// Readonly object with literal types
const config = {
  mode: "production",
  port: 3000,
} as const;
type Mode = typeof config.mode; // "production"
type Port = typeof config.port; // 3000
```

**Creating type-safe constants:**

```typescript
// Route definitions
const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  USER: "/user/:id",
} as const;

type Route = typeof ROUTES[keyof typeof ROUTES];
// "/" | "/about" | "/user/:id"

// Action types for reducers
const ActionTypes = {
  INCREMENT: "counter/increment",
  DECREMENT: "counter/decrement",
  RESET: "counter/reset",
} as const;

type ActionType = typeof ActionTypes[keyof typeof ActionTypes];
// "counter/increment" | "counter/decrement" | "counter/reset"
```

**Function return values:**

```typescript
// Without as const: inferred as { x: number; y: number }
function getPoint() {
  return { x: 10, y: 20 };
}

// With as const: inferred as { readonly x: 10; readonly y: 20 }
function getPoint() {
  return { x: 10, y: 20 } as const;
}

// Useful for tuple returns
function useState<T>(initial: T) {
  // Without as const: (T | (value: T) => void)[]
  // With as const: readonly [T, (value: T) => void]
  return [initial, (value: T) => {}] as const;
}
```

**Key behaviors:**

| Without `as const` | With `as const` |
|-------------------|-----------------|
| `"hello"` → `string` | `"hello"` → `"hello"` |
| `[1, 2]` → `number[]` | `[1, 2]` → `readonly [1, 2]` |
| `{ a: 1 }` → `{ a: number }` | `{ a: 1 }` → `{ readonly a: 1 }` |

Note: `as const` makes the entire structure deeply readonly. Use `satisfies` with `as const` when you need both validation and literal preservation.
