---
title: Exhaustive Checking with never
impact: MEDIUM
impactDescription: catches missing union cases at compile time
tags: never, exhaustive, switch, discriminated-unions
---

## Exhaustive Checking with never

Use the `never` type to ensure all cases in a union are handled. If a case is missing, TypeScript will error at compile time.

**Incorrect (missing cases not caught):**

```typescript
type Status = "pending" | "active" | "completed" | "cancelled";

function getStatusMessage(status: Status): string {
  switch (status) {
    case "pending":
      return "Waiting to start";
    case "active":
      return "In progress";
    // "completed" and "cancelled" missing - no error!
  }
  return "Unknown"; // Fallback hides the bug
}

// Later, when a new status is added:
type Status = "pending" | "active" | "completed" | "cancelled" | "archived";
// No error tells you to update getStatusMessage
```

**Correct (exhaustive checking with never):**

```typescript
function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}

type Status = "pending" | "active" | "completed" | "cancelled";

function getStatusMessage(status: Status): string {
  switch (status) {
    case "pending":
      return "Waiting to start";
    case "active":
      return "In progress";
    case "completed":
      return "Done";
    case "cancelled":
      return "Cancelled";
    default:
      // If any case is missing, status won't be never
      // and this will error at compile time
      return assertNever(status);
  }
}

// When a new status is added:
type Status = "pending" | "active" | "completed" | "cancelled" | "archived";
// Error: Argument of type '"archived"' is not assignable to parameter of type 'never'
```

**With discriminated unions:**

```typescript
type Action =
  | { type: "INCREMENT"; amount: number }
  | { type: "DECREMENT"; amount: number }
  | { type: "RESET" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "INCREMENT":
      return state + action.amount;
    case "DECREMENT":
      return state - action.amount;
    case "RESET":
      return 0;
    default:
      return assertNever(action);
  }
}
```

**Alternative: satisfies never:**

```typescript
function getStatusMessage(status: Status): string {
  switch (status) {
    case "pending":
      return "Waiting";
    case "active":
      return "Active";
    case "completed":
      return "Done";
    case "cancelled":
      return "Cancelled";
    default:
      // Inline exhaustive check without helper function
      const _exhaustive: never = status;
      throw new Error(`Unhandled: ${_exhaustive}`);
  }
}
```

**Key benefits:**

- Compile-time errors when cases are missing
- Runtime errors if somehow an unexpected value reaches the default
- Self-documenting: makes it clear all cases should be handled
- Safe refactoring: adding new union members surfaces all places that need updates
