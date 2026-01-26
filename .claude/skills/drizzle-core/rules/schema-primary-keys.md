---
title: Primary Key Patterns
impact: CRITICAL
impactDescription: ensures unique row identification and referential integrity
tags: schema, primary-key, composite, identity
---

## Primary Key Patterns

Every table needs a primary key for unique row identification. Use single-column keys for most tables and composite keys for junction/join tables.

**Incorrect (no primary key):**

```typescript
export const users = mssqlTable('users', {
  id: int('id'),  // Not marked as primary key
  email: varchar('email', { length: 255 }),
});
// Table has no way to uniquely identify rows
```

**Correct (single column primary key):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
});
```

**Composite primary key (for junction tables):**

```typescript
import { mssqlTable, int, primaryKey } from 'drizzle-orm/mssql-core';

// Incorrect: two separate primary keys
export const booksToAuthors = mssqlTable('books_to_authors', {
  bookId: int('book_id').primaryKey(),    // Wrong!
  authorId: int('author_id').primaryKey(), // Can't have two PKs
});

// Correct: composite primary key
export const booksToAuthors = mssqlTable('books_to_authors', {
  bookId: int('book_id').notNull(),
  authorId: int('author_id').notNull(),
}, (table) => [
  primaryKey({ columns: [table.bookId, table.authorId] }),
]);
```

**Named composite primary key:**

```typescript
export const userRoles = mssqlTable('user_roles', {
  userId: int('user_id').notNull(),
  roleId: int('role_id').notNull(),
}, (table) => [
  primaryKey({
    name: 'user_roles_pk',
    columns: [table.userId, table.roleId]
  }),
]);
```

Use composite primary keys for many-to-many junction tables where the combination of foreign keys uniquely identifies each row.
