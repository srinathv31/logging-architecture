---
title: Column Modifiers
impact: HIGH
impactDescription: ensures proper nullability and type safety
tags: schema, columns, modifiers, notNull, default
---

## Column Modifiers

Use column modifiers to define nullability, defaults, and type overrides. Proper use of modifiers ensures accurate TypeScript types and database constraints.

**Incorrect (missing modifiers):**

```typescript
export const users = mssqlTable('users', {
  id: int('id'),  // Not marked as primary key
  email: varchar('email', { length: 255 }),  // Nullable by default
  status: varchar('status', { length: 50 }),  // No default
});
// email will be string | null in TypeScript - may cause null checks everywhere
```

**Correct (explicit modifiers):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: datetime2('created_at').notNull().defaultNow(),
});
// email is string (not null), status has default value
```

**Available modifiers:**

```typescript
export const example = mssqlTable('example', {
  // Primary key
  id: int('id').primaryKey(),

  // Not null constraint
  required: varchar('required', { length: 100 }).notNull(),

  // Default values
  status: varchar('status', { length: 50 }).default('pending'),
  count: int('count').default(0),

  // SQL expression default
  uuid: varchar('uuid', { length: 36 }).default(sql`NEWID()`),

  // Custom type override for TypeScript
  metadata: nvarchar('metadata', { length: 'max' }).$type<Record<string, unknown>>(),

  // Enum-like type (TypeScript only, no DB constraint)
  role: varchar('role', { length: 20 }).$type<'admin' | 'user' | 'guest'>(),
});
```

Chain modifiers in logical order: type definition → `.notNull()` → `.default()` → `.$type<>()`.
