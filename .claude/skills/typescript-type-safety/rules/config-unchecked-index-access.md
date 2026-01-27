---
title: noUncheckedIndexedAccess
impact: HIGH
impactDescription: prevents undefined access errors at runtime
tags: tsconfig, array-access, index-signature, undefined
---

## noUncheckedIndexedAccess

Enable `noUncheckedIndexedAccess` to make array and index signature access return `T | undefined`. This forces you to handle potentially missing values.

**Incorrect (unchecked access, runtime errors):**

```json
{
  "compilerOptions": {
    "strict": true
    // noUncheckedIndexedAccess not enabled
  }
}
```

```typescript
const items = ["a", "b", "c"];

// TypeScript assumes this is string, but could be undefined
const item = items[10]; // Type: string (wrong!)
console.log(item.toUpperCase()); // Runtime error: undefined

// Same with objects using index signatures
const cache: Record<string, number> = {};
const value = cache["missing"]; // Type: number (wrong!)
console.log(value.toFixed(2)); // Runtime error: undefined
```

**Correct (noUncheckedIndexedAccess enabled):**

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

// Now correctly typed as string | undefined
const item = items[10];
console.log(item.toUpperCase()); // Error: item might be undefined

// Must handle the undefined case
if (item !== undefined) {
  console.log(item.toUpperCase()); // Safe
}

// Or use optional chaining
console.log(item?.toUpperCase()); // Safe, returns undefined
```

**Working with arrays:**

```typescript
const items = ["a", "b", "c"];

// Pattern 1: Check before use
const first = items[0];
if (first !== undefined) {
  process(first);
}

// Pattern 2: Non-null assertion (when you know it exists)
const definitelyFirst = items[0]!; // Use sparingly

// Pattern 3: Optional chaining for safe access
items[0]?.toUpperCase();

// Pattern 4: Array methods that guarantee element exists
items.forEach((item) => {
  // item is string, not string | undefined
  console.log(item.toUpperCase());
});

// find/filter preserve the undefined possibility correctly
const found = items.find(i => i === "a"); // string | undefined
```

**Working with index signatures:**

```typescript
type Cache = Record<string, User>;
const cache: Cache = {};

// Access returns User | undefined
const user = cache["id-123"];

// Must handle undefined
if (user) {
  console.log(user.name);
}

// When setting values, no undefined needed
cache["id-456"] = newUser; // Fine
```

This flag is not included in `strict: true`. Enable it explicitly for maximum safety with dynamic access patterns.
