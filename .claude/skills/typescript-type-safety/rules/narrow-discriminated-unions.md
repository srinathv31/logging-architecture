---
title: Discriminated Union Narrowing
impact: CRITICAL
impactDescription: enables exhaustive type-safe handling of union variants
tags: narrowing, discriminated-unions, tagged-unions, switch
---

## Discriminated Union Narrowing

Use a common literal property (discriminant) to narrow union types. TypeScript narrows the type based on the discriminant value in switch/if statements.

**Incorrect (no discriminant, manual type checking):**

```typescript
type Success = { data: string };
type Error = { error: string };
type Loading = { progress: number };
type State = Success | Error | Loading;

function handle(state: State) {
  // No way to safely distinguish types
  if (state.data) { } // Error: data doesn't exist on all variants

  // Using "in" works but is verbose and error-prone
  if ("data" in state) {
    console.log(state.data);
  }
}
```

**Correct (discriminated union with type field):**

```typescript
type Success = { type: "success"; data: string };
type Error = { type: "error"; error: string };
type Loading = { type: "loading"; progress: number };
type State = Success | Error | Loading;

function handle(state: State) {
  switch (state.type) {
    case "success":
      // state is Success
      console.log(state.data);
      break;
    case "error":
      // state is Error
      console.log(state.error);
      break;
    case "loading":
      // state is Loading
      console.log(`${state.progress}%`);
      break;
  }
}
```

**With exhaustive checking:**

```typescript
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

function handle(state: State): string {
  switch (state.type) {
    case "success":
      return state.data;
    case "error":
      return state.error;
    case "loading":
      return `${state.progress}%`;
    default:
      // Compile error if a case is missing
      return assertNever(state);
  }
}
```

**Common discriminant patterns:**

```typescript
// API responses
type ApiResponse<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string };

// Redux-style actions
type Action =
  | { type: "INCREMENT"; amount: number }
  | { type: "DECREMENT"; amount: number }
  | { type: "RESET" };

// Result type
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

The discriminant property must use literal types (string literals, number literals, or boolean) for TypeScript to narrow correctly.
