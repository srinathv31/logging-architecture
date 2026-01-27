---
title: in Operator Narrowing
impact: HIGH
impactDescription: enables narrowing by property existence
tags: narrowing, in-operator, property-checking, type-guards
---

## in Operator Narrowing

Use the `in` operator to narrow types based on property existence. TypeScript narrows to union members that have the checked property.

**Incorrect (property access without narrowing):**

```typescript
type Fish = { swim: () => void };
type Bird = { fly: () => void };
type Pet = Fish | Bird;

function move(pet: Pet) {
  // Error: swim doesn't exist on Bird
  pet.swim();

  // Checking truthiness doesn't narrow
  if (pet.swim) {
    pet.swim(); // Still errors
  }
}
```

**Correct (in operator narrowing):**

```typescript
type Fish = { swim: () => void };
type Bird = { fly: () => void };
type Pet = Fish | Bird;

function move(pet: Pet) {
  if ("swim" in pet) {
    pet.swim(); // pet is Fish
  } else {
    pet.fly(); // pet is Bird
  }
}
```

**With optional properties:**

```typescript
type Admin = {
  name: string;
  permissions: string[];
};
type User = {
  name: string;
  email?: string;
};
type Person = Admin | User;

function describe(person: Person) {
  // "permissions" uniquely identifies Admin
  if ("permissions" in person) {
    console.log(`Admin with ${person.permissions.length} permissions`);
  } else {
    console.log(`User: ${person.name}`);
  }
}
```

**Combining with other narrowing:**

```typescript
type Circle = { kind: "circle"; radius: number };
type Square = { kind: "square"; size: number };
type Rectangle = { kind: "rectangle"; width: number; height: number };
type Shape = Circle | Square | Rectangle;

function area(shape: Shape): number {
  // Use "in" when discriminant isn't available
  if ("radius" in shape) {
    return Math.PI * shape.radius ** 2;
  }
  if ("size" in shape) {
    return shape.size ** 2;
  }
  return shape.width * shape.height;
}
```

Prefer discriminated unions when possible. Use `in` when:
- Working with external types you can't modify
- Types differ by property existence rather than property values
- Checking for optional properties
