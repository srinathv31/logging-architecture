---
title: When to Annotate vs Infer
impact: HIGH
impactDescription: balances type safety with code verbosity
tags: inference, annotations, parameters, return-types
---

## When to Annotate vs Infer

TypeScript can infer many types automatically. Annotate when it improves safety or documentation; let TypeScript infer when the type is obvious from context.

**Incorrect (over-annotating obvious types):**

```typescript
// Redundant: type is obvious from initializer
const name: string = "Alice";
const count: number = 42;
const items: string[] = ["a", "b", "c"];

// Redundant: return type is obvious from implementation
function double(n: number): number {
  return n * 2;
}

// Redundant: map callback types
const doubled: number[] = numbers.map((n: number): number => n * 2);
```

**Incorrect (under-annotating when needed):**

```typescript
// Missing: parameters have implicit any
function greet(name) {
  return `Hello, ${name}`;
}

// Missing: public API loses documentation value
export function fetchUser(id) {
  // Return type unclear to consumers
}

// Missing: empty arrays infer as never[]
const items = [];
items.push("hello"); // Error: string not assignable to never
```

**Correct (strategic annotations):**

```typescript
// ANNOTATE: function parameters (required in strict mode)
function greet(name: string) {
  return `Hello, ${name}`;
}

// ANNOTATE: exported/public APIs for documentation
export function fetchUser(id: string): Promise<User | null> {
  // Consumers see the contract clearly
}

// ANNOTATE: empty arrays that will be filled later
const items: string[] = [];
items.push("hello"); // Works

// ANNOTATE: when inference produces wider type than desired
const config: Config = {
  mode: "production", // Without annotation, inferred as string not literal
};

// INFER: local variables with clear initializers
const name = "Alice";
const count = 42;

// INFER: callback return types
const doubled = numbers.map(n => n * 2);

// INFER: internal implementation details
function internal() {
  const result = process();
  return transform(result);
}
```

**Guidelines:**

| Scenario | Annotate? |
|----------|-----------|
| Function parameters | Yes |
| Exported function return types | Yes |
| Variables with initializers | No |
| Empty arrays/objects | Yes |
| Callbacks in array methods | No |
| Complex object literals | Sometimes |
| When inference is too wide | Yes |
