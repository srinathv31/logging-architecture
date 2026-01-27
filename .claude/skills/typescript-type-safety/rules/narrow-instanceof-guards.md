---
title: instanceof Type Guards
impact: CRITICAL
impactDescription: enables safe narrowing for class instances
tags: narrowing, instanceof, classes, type-guards
---

## instanceof Type Guards

Use `instanceof` to narrow types to specific class instances. This works with classes but not interfaces or type aliases.

**Incorrect (no narrowing, accessing subclass properties):**

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

// instanceof doesn't work with interfaces
interface Dog { bark(): void; }
interface Cat { meow(): void; }

function handlePet(pet: Dog | Cat) {
  // Error: 'Dog' only refers to a type
  if (pet instanceof Dog) { }
}
```

**Correct (instanceof narrowing):**

```typescript
class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function handleError(error: Error) {
  if (error instanceof ApiError) {
    // error is ApiError here
    console.log(`API Error ${error.statusCode}: ${error.message}`);
  } else if (error instanceof TypeError) {
    console.log(`Type Error: ${error.message}`);
  } else {
    console.log(`Unknown Error: ${error.message}`);
  }
}
```

**Common instanceof use cases:**

```typescript
// DOM element narrowing
function handleElement(el: Element) {
  if (el instanceof HTMLInputElement) {
    console.log(el.value); // Has value property
  } else if (el instanceof HTMLAnchorElement) {
    console.log(el.href); // Has href property
  }
}

// Date checking
function formatValue(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}
```

`instanceof` checks the prototype chain, so it works with subclasses. For interfaces, use discriminated unions or the `in` operator instead.
