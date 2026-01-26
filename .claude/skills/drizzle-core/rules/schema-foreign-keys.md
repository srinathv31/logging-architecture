---
title: Foreign Key Relationships
impact: HIGH
impactDescription: maintains referential integrity between tables
tags: schema, foreign-key, references, relationships
---

## Foreign Key Relationships

Foreign keys establish relationships between tables and maintain referential integrity. Use the `.references()` method for single-column keys or `foreignKey()` for multi-column keys.

**Incorrect (no foreign key constraint):**

```typescript
export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  authorId: int('author_id'),  // No foreign key - allows orphaned records
  title: varchar('title', { length: 255 }),
});
```

**Correct (inline foreign key):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  authorId: int('author_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
});
```

**Self-referencing foreign key:**

```typescript
import { mssqlTable, int, varchar, type AnyMssqlColumn } from 'drizzle-orm/mssql-core';

export const employees = mssqlTable('employees', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  // Must specify return type for self-reference
  managerId: int('manager_id').references((): AnyMssqlColumn => employees.id),
});
```

**Multi-column foreign key:**

```typescript
import { mssqlTable, int, varchar, foreignKey } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.firstName, table.lastName] }),
]);

export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  userFirstName: varchar('user_first_name', { length: 100 }),
  userLastName: varchar('user_last_name', { length: 100 }),
}, (table) => [
  foreignKey({
    columns: [table.userFirstName, table.userLastName],
    foreignColumns: [users.firstName, users.lastName],
  }),
]);
```

**With cascade actions:**

```typescript
export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  authorId: int('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
});
```

Options for `onDelete` and `onUpdate`: `'cascade'`, `'restrict'`, `'no action'`, `'set null'`, `'set default'`.
