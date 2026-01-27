---
title: Strict Mode Configuration
impact: HIGH
impactDescription: catches common errors at compile time
tags: tsconfig, strict, compiler-options, configuration
---

## Strict Mode Configuration

Enable `strict: true` in tsconfig.json to activate all strict type-checking options. This catches common errors at compile time rather than runtime.

**Incorrect (loose configuration):**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs"
    // No strict mode - many errors slip through
  }
}
```

```typescript
// Without strictNullChecks: null/undefined not caught
function greet(name: string) {
  console.log(name.toUpperCase()); // Runtime error if null
}
greet(null); // No compile error!

// Without noImplicitAny: parameters become any
function process(data) {
  return data.foo.bar; // No type checking
}

// Without strictPropertyInitialization
class User {
  name: string; // Uninitialized but no error
}
```

**Correct (strict mode enabled):**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true
  }
}
```

```typescript
// strictNullChecks: must handle null
function greet(name: string | null) {
  if (name) {
    console.log(name.toUpperCase()); // Safe
  }
}

// noImplicitAny: parameters must be typed
function process(data: ProcessData) {
  return data.foo.bar; // Type-checked
}

// strictPropertyInitialization: must initialize
class User {
  name: string;
  constructor(name: string) {
    this.name = name; // Required
  }
}
```

**What strict: true enables:**

| Flag | What it does |
|------|--------------|
| `strictNullChecks` | null/undefined not assignable to other types |
| `strictFunctionTypes` | Stricter function parameter checking |
| `strictBindCallApply` | Check bind, call, apply argument types |
| `strictPropertyInitialization` | Class properties must be initialized |
| `noImplicitAny` | Error on expressions with implied any |
| `noImplicitThis` | Error on this with implied any type |
| `useUnknownInCatchVariables` | catch clause variables are unknown |
| `alwaysStrict` | Emit "use strict" in output |

**Migrating to strict mode:**

```json
{
  "compilerOptions": {
    // Enable incrementally if strict: true is too many errors
    "strictNullChecks": true,
    "noImplicitAny": true,
    // Add more as you fix errors
  }
}
```

Always use `strict: true` for new projects. For existing projects, enable strict flags incrementally.
