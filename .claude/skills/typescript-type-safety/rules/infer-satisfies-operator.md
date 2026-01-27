---
title: satisfies Operator
impact: HIGH
impactDescription: validates types while preserving literal inference
tags: satisfies, inference, literal-types, typescript-4.9
---

## satisfies Operator

Use `satisfies` (TypeScript 4.9+) to validate a value matches a type while preserving the inferred literal types. This gives you type checking without widening.

**Incorrect (type annotation widens literals):**

```typescript
type Colors = Record<string, [number, number, number]>;

// Type annotation widens the keys to string
const colors: Colors = {
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
};

// Error: "red" could be any string key, so no autocomplete
colors.red; // Works but no autocomplete for keys

// Type annotation loses literal type
const routes: Record<string, string> = {
  home: "/",
  about: "/about",
};
routes.home; // string, not "/"
```

**Correct (satisfies preserves literals):**

```typescript
type Colors = Record<string, [number, number, number]>;

const colors = {
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
} satisfies Colors;

// Keys are preserved as literals
colors.red; // Autocomplete works!
colors.purple; // Error: purple doesn't exist

// Values keep their literal types
const routes = {
  home: "/",
  about: "/about",
} satisfies Record<string, string>;

routes.home; // Type is "/" not string
```

**Catching errors while preserving inference:**

```typescript
type Config = {
  port: number;
  host: string;
  debug?: boolean;
};

// Without satisfies: typo not caught
const config1 = {
  port: 3000,
  hots: "localhost", // Typo! But no error
};

// With satisfies: typo caught
const config2 = {
  port: 3000,
  hots: "localhost", // Error: 'hots' not in Config
} satisfies Config;

// Correct version preserves literal types
const config3 = {
  port: 3000,
  host: "localhost",
  debug: true,
} satisfies Config;

config3.port; // Type is 3000, not number
```

**Combining with as const:**

```typescript
// as const makes values readonly and literal
// satisfies validates against a type
const themes = {
  light: { bg: "#fff", fg: "#000" },
  dark: { bg: "#000", fg: "#fff" },
} as const satisfies Record<string, { bg: string; fg: string }>;

// Keys are "light" | "dark" (not string)
// Values are readonly with literal types
// But still validated against the Record type
```

Use `satisfies` when you want both type validation and preserved literal inference. Use type annotations when you want to explicitly widen to a type.
