# TypeScript Type Safety Patterns - Complete Guide

> This document is mainly for agents and LLMs. For the overview and quick reference, see `SKILL.md`.

## Abstract

This guide provides practical patterns for TypeScript type inference and safety. It covers type narrowing techniques, when to annotate vs infer, strict compiler settings, and exhaustive checking patterns. These patterns apply to any TypeScript codebase and focus on everyday type safety rather than advanced generic patterns.

## Table of Contents

1. [typeof Type Guards](#1-typeof-type-guards)
2. [instanceof Type Guards](#2-instanceof-type-guards)
3. [Discriminated Union Narrowing](#3-discriminated-union-narrowing)
4. [in Operator Narrowing](#4-in-operator-narrowing)
5. [When to Annotate vs Infer](#5-when-to-annotate-vs-infer)
6. [The satisfies Operator](#6-the-satisfies-operator)
7. [const Assertions](#7-const-assertions)
8. [Strict Mode Configuration](#8-strict-mode-configuration)
9. [noUncheckedIndexedAccess](#9-nouncheckedindexedaccess)
10. [Exhaustive Checking with never](#10-exhaustive-checking-with-never)

---

## 1. typeof Type Guards

**Impact: CRITICAL**

Use `typeof` to narrow union types containing primitives. TypeScript understands `typeof` checks and narrows the type in the corresponding branch.

**Incorrect:**

```typescript
function process(value: string | number) {
  // Error: toUpperCase doesn't exist on number
  return value.toUpperCase();
}

function handle(value: string | null) {
  // typeof null returns "object", not "null"!
  if (typeof value === "object") {
    console.log(value.length); // Runtime error if null
  }
}
```

**Correct:**

```typescript
function process(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase(); // value is string
  }
  return value.toFixed(2); // value is number
}

function handle(value: string | null) {
  if (value === null) {
    return "No value";
  }
  return value.toUpperCase(); // value is string
}
```

Always use strict equality (`===`) with `null` instead of `typeof` for null checks.

---

## 2. instanceof Type Guards

**Impact: CRITICAL**

Use `instanceof` to narrow types to specific class instances. This works with classes but not interfaces or type aliases.

**Incorrect:**

```typescript
class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function handleError(error: Error) {
  // Error: statusCode doesn't exist on Error
  console.log(error.statusCode);
}
```

**Correct:**

```typescript
function handleError(error: Error) {
  if (error instanceof ApiError) {
    console.log(`API Error ${error.statusCode}: ${error.message}`);
  } else if (error instanceof TypeError) {
    console.log(`Type Error: ${error.message}`);
  } else {
    console.log(`Unknown Error: ${error.message}`);
  }
}

// DOM element narrowing
function handleElement(el: Element) {
  if (el instanceof HTMLInputElement) {
    console.log(el.value);
  } else if (el instanceof HTMLAnchorElement) {
    console.log(el.href);
  }
}
```

For interfaces, use discriminated unions or the `in` operator instead.

---

## 3. Discriminated Union Narrowing

**Impact: CRITICAL**

Use a common literal property (discriminant) to narrow union types. TypeScript narrows the type based on the discriminant value in switch/if statements.

**Incorrect:**

```typescript
type Success = { data: string };
type Error = { error: string };
type State = Success | Error;

function handle(state: State) {
  // No way to safely distinguish types
  if (state.data) { } // Error: data doesn't exist on all variants
}
```

**Correct:**

```typescript
type Success = { type: "success"; data: string };
type Error = { type: "error"; error: string };
type Loading = { type: "loading"; progress: number };
type State = Success | Error | Loading;

function handle(state: State) {
  switch (state.type) {
    case "success":
      return state.data;
    case "error":
      return state.error;
    case "loading":
      return `${state.progress}%`;
  }
}
```

The discriminant property must use literal types (string literals, number literals, or boolean) for TypeScript to narrow correctly.

---

## 4. in Operator Narrowing

**Impact: HIGH**

Use the `in` operator to narrow types based on property existence. TypeScript narrows to union members that have the checked property.

**Incorrect:**

```typescript
type Fish = { swim: () => void };
type Bird = { fly: () => void };
type Pet = Fish | Bird;

function move(pet: Pet) {
  pet.swim(); // Error: swim doesn't exist on Bird
}
```

**Correct:**

```typescript
function move(pet: Pet) {
  if ("swim" in pet) {
    pet.swim(); // pet is Fish
  } else {
    pet.fly(); // pet is Bird
  }
}
```

Prefer discriminated unions when possible. Use `in` when working with external types or when types differ by property existence.

---

## 5. When to Annotate vs Infer

**Impact: HIGH**

TypeScript can infer many types automatically. Annotate when it improves safety or documentation; let TypeScript infer when the type is obvious from context.

**Annotate these:**

```typescript
// Function parameters (required in strict mode)
function greet(name: string) {
  return `Hello, ${name}`;
}

// Exported/public APIs for documentation
export function fetchUser(id: string): Promise<User | null> {
  // ...
}

// Empty arrays that will be filled later
const items: string[] = [];

// When inference produces wider type than desired
const config: Config = { mode: "production" };
```

**Let TypeScript infer these:**

```typescript
// Local variables with clear initializers
const name = "Alice";
const count = 42;

// Callback return types
const doubled = numbers.map(n => n * 2);

// Internal implementation details
function internal() {
  return process();
}
```

---

## 6. The satisfies Operator

**Impact: HIGH**

Use `satisfies` (TypeScript 4.9+) to validate a value matches a type while preserving the inferred literal types.

**Incorrect (type annotation widens literals):**

```typescript
const colors: Record<string, [number, number, number]> = {
  red: [255, 0, 0],
  green: [0, 255, 0],
};
colors.red; // Works but no autocomplete for keys
```

**Correct (satisfies preserves literals):**

```typescript
const colors = {
  red: [255, 0, 0],
  green: [0, 255, 0],
} satisfies Record<string, [number, number, number]>;

colors.red; // Autocomplete works!
colors.purple; // Error: purple doesn't exist
```

Use `satisfies` when you want both type validation and preserved literal inference.

---

## 7. const Assertions

**Impact: HIGH**

Use `as const` to tell TypeScript to infer the narrowest possible type. This creates readonly structures and preserves literal types.

**Incorrect (literals widened):**

```typescript
const statuses = ["pending", "active", "done"];
type Status = typeof statuses[number]; // string
```

**Correct (as const preserves literals):**

```typescript
const statuses = ["pending", "active", "done"] as const;
type Status = typeof statuses[number]; // "pending" | "active" | "done"

const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
} as const;
type Route = typeof ROUTES[keyof typeof ROUTES]; // "/" | "/about"
```

Note: `as const` makes the entire structure deeply readonly.

---

## 8. Strict Mode Configuration

**Impact: HIGH**

Enable `strict: true` in tsconfig.json to activate all strict type-checking options.

**Incorrect:**

```json
{
  "compilerOptions": {
    "target": "ES2020"
  }
}
```

**Correct:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true
  }
}
```

**What strict: true enables:**

- `strictNullChecks` - null/undefined not assignable to other types
- `strictFunctionTypes` - Stricter function parameter checking
- `noImplicitAny` - Error on expressions with implied any
- `strictPropertyInitialization` - Class properties must be initialized
- `useUnknownInCatchVariables` - catch clause variables are unknown

Always use `strict: true` for new projects.

---

## 9. noUncheckedIndexedAccess

**Impact: HIGH**

Enable `noUncheckedIndexedAccess` to make array and index signature access return `T | undefined`.

**Incorrect (without flag):**

```typescript
const items = ["a", "b", "c"];
const item = items[10]; // Type: string (wrong!)
console.log(item.toUpperCase()); // Runtime error
```

**Correct (with flag enabled):**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

```typescript
const items = ["a", "b", "c"];
const item = items[10]; // Type: string | undefined

if (item !== undefined) {
  console.log(item.toUpperCase()); // Safe
}
```

This flag is not included in `strict: true`. Enable it explicitly for maximum safety.

---

## 10. Exhaustive Checking with never

**Impact: MEDIUM**

Use the `never` type to ensure all cases in a union are handled. If a case is missing, TypeScript will error at compile time.

**Incorrect (missing cases not caught):**

```typescript
type Status = "pending" | "active" | "completed";

function getMessage(status: Status): string {
  switch (status) {
    case "pending":
      return "Waiting";
    case "active":
      return "In progress";
    // "completed" missing - no error!
  }
  return "Unknown";
}
```

**Correct (exhaustive checking):**

```typescript
function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}

function getMessage(status: Status): string {
  switch (status) {
    case "pending":
      return "Waiting";
    case "active":
      return "In progress";
    case "completed":
      return "Done";
    default:
      return assertNever(status); // Compile error if case missing
  }
}
```

This catches missing union cases at compile time and provides runtime safety.
