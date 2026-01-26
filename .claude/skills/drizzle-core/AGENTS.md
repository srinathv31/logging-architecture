# Drizzle Core Schema Patterns - Complete Guide

> This document is mainly for agents and LLMs. For the overview and quick reference, see `SKILL.md`.

## Abstract

This guide provides comprehensive patterns for defining database schemas with Drizzle ORM. It covers table definitions, column modifiers, primary keys, foreign keys, constraints, indexes, and relations. These patterns apply to all Drizzle-supported databases (PostgreSQL, MySQL, SQLite, MSSQL).

## Table of Contents

1. [Table Definition Structure](#1-table-definition-structure)
2. [Column Modifiers](#2-column-modifiers)
3. [Primary Key Patterns](#3-primary-key-patterns)
4. [Foreign Key Relationships](#4-foreign-key-relationships)
5. [Unique Constraints](#5-unique-constraints)
6. [Index Creation](#6-index-creation)
7. [Check Constraints](#7-check-constraints)
8. [Default Values](#8-default-values)
9. [Drizzle Relations](#9-drizzle-relations)

---

## 1. Table Definition Structure

**Impact: CRITICAL** - ensures proper schema structure and type inference

Define tables using the database-specific table function with proper column definitions and exported constants. This ensures TypeScript type inference works correctly and schemas are reusable.

**Incorrect (inline, non-exported):**

```typescript
// Missing export - can't be used in queries or relations
const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }),
});

// Wrong: defining columns outside table function
const idColumn = int('id').primaryKey();
```

**Correct (exported with proper structure):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
});

// Type can be inferred for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**With constraints callback:**

```typescript
import { mssqlTable, int, varchar, uniqueIndex } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
}, (table) => [
  uniqueIndex('email_idx').on(table.email),
]);
```

The table function takes the table name as the first argument, column definitions as the second, and an optional callback for constraints/indexes as the third.

---

## 2. Column Modifiers

**Impact: HIGH** - ensures proper nullability and type safety

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

---

## 3. Primary Key Patterns

**Impact: CRITICAL** - ensures unique row identification and referential integrity

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

---

## 4. Foreign Key Relationships

**Impact: HIGH** - maintains referential integrity between tables

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

---

## 5. Unique Constraints

**Impact: HIGH** - prevents duplicate values in columns

Unique constraints ensure no duplicate values exist in a column or combination of columns. Use inline `.unique()` for single columns or `unique()` function for composite constraints.

**Incorrect (no unique constraint on email):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),  // Allows duplicates
});
```

**Correct (single column unique):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
});

// Or with custom constraint name
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique('users_email_unique'),
});
```

**Composite unique constraint:**

```typescript
import { mssqlTable, int, varchar, unique } from 'drizzle-orm/mssql-core';

export const memberships = mssqlTable('memberships', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  organizationId: int('organization_id').notNull(),
}, (table) => [
  // User can only be member of an organization once
  unique('user_org_unique').on(table.userId, table.organizationId),
]);
```

**Multiple unique constraints:**

```typescript
export const products = mssqlTable('products', {
  id: int('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull(),
  barcode: varchar('barcode', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
}, (table) => [
  unique('sku_unique').on(table.sku),
  unique('barcode_unique').on(table.barcode),
]);
```

**Important MSSQL limitation:** Cannot create unique constraints on `text`, `ntext`, `varchar(max)`, or `nvarchar(max)` columns. Use bounded length columns instead:

```typescript
// Won't work in MSSQL
email: varchar('email', { length: 'max' }).unique()  // Error!

// Use bounded length
email: varchar('email', { length: 255 }).unique()    // Works
```

---

## 6. Index Creation

**Impact: MEDIUM** - improves query performance on frequently searched columns

Indexes improve query performance on columns used in WHERE clauses, JOINs, and ORDER BY. Add indexes strategically - they speed up reads but slow down writes.

**Incorrect (missing index on frequently queried column):**

```typescript
export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
});
// Queries filtering by userId or status will be slow without indexes
```

**Correct (indexes on query columns):**

```typescript
import { mssqlTable, int, varchar, datetime2, index } from 'drizzle-orm/mssql-core';

export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
}, (table) => [
  index('orders_user_id_idx').on(table.userId),
  index('orders_status_idx').on(table.status),
  index('orders_created_at_idx').on(table.createdAt),
]);
```

**Composite index (for multi-column queries):**

```typescript
export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
}, (table) => [
  // For queries: WHERE user_id = ? AND status = ?
  index('orders_user_status_idx').on(table.userId, table.status),
]);
```

**Unique index:**

```typescript
import { mssqlTable, int, varchar, uniqueIndex } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
]);
```

**Index guidelines:**
- Add indexes on foreign key columns (for JOIN performance)
- Add indexes on columns frequently used in WHERE clauses
- Use composite indexes for queries filtering on multiple columns
- Order matters: `(userId, status)` index helps `WHERE userId = ?` but not `WHERE status = ?`
- Avoid over-indexing - each index adds write overhead

---

## 7. Check Constraints

**Impact: MEDIUM** - enforces data validation at database level

Check constraints enforce data validation rules at the database level, ensuring data integrity regardless of application code.

**Incorrect (validation only in application):**

```typescript
export const products = mssqlTable('products', {
  id: int('id').primaryKey(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  quantity: int('quantity').notNull(),
});
// Negative prices or quantities could be inserted directly to DB
```

**Correct (database-level validation):**

```typescript
import { mssqlTable, int, decimal, check } from 'drizzle-orm/mssql-core';
import { sql } from 'drizzle-orm';

export const products = mssqlTable('products', {
  id: int('id').primaryKey(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  quantity: int('quantity').notNull(),
}, (table) => [
  check('price_positive', sql`${table.price} >= 0`),
  check('quantity_non_negative', sql`${table.quantity} >= 0`),
]);
```

**Multiple conditions:**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  age: int('age'),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
}, (table) => [
  check('age_valid', sql`${table.age} IS NULL OR ${table.age} >= 0`),
  check('status_valid', sql`${table.status} IN ('active', 'inactive', 'pending')`),
  check('email_format', sql`${table.email} LIKE '%@%.%'`),
]);
```

**Range constraints:**

```typescript
export const events = mssqlTable('events', {
  id: int('id').primaryKey(),
  startDate: datetime2('start_date').notNull(),
  endDate: datetime2('end_date').notNull(),
  minAttendees: int('min_attendees').notNull(),
  maxAttendees: int('max_attendees').notNull(),
}, (table) => [
  check('dates_valid', sql`${table.endDate} > ${table.startDate}`),
  check('attendees_valid', sql`${table.maxAttendees} >= ${table.minAttendees}`),
]);
```

Check constraints are enforced on INSERT and UPDATE operations. Use them for business rules that must always be true regardless of how data is modified.

---

## 8. Default Values

**Impact: MEDIUM** - simplifies inserts and ensures consistent data

Default values automatically populate columns when no value is provided during INSERT. Use static values, SQL expressions, or JavaScript functions.

**Incorrect (manual defaults in application):**

```typescript
export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime2('created_at').notNull(),
});

// Application code must always provide these values
await db.insert(posts).values({
  status: 'draft',  // Must remember to set default
  createdAt: new Date(),  // Must remember to set default
});
```

**Correct (database defaults):**

```typescript
import { mssqlTable, int, varchar, datetime2 } from 'drizzle-orm/mssql-core';
import { sql } from 'drizzle-orm';

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  createdAt: datetime2('created_at').notNull().defaultNow(),
});

// Values are automatic - cleaner insert
await db.insert(posts).values({ title: 'My Post' });
```

**Static defaults:**

```typescript
export const settings = mssqlTable('settings', {
  id: int('id').primaryKey(),
  isEnabled: bit('is_enabled').notNull().default(true),
  retryCount: int('retry_count').notNull().default(3),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
});
```

**SQL expression defaults:**

```typescript
import { sql } from 'drizzle-orm';

export const records = mssqlTable('records', {
  id: int('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().default(sql`NEWID()`),
  createdAt: datetime2('created_at').notNull().default(sql`GETDATE()`),
  updatedAt: datetime2('updated_at').notNull().default(sql`GETDATE()`),
});
```

**JavaScript function defaults ($defaultFn):**

```typescript
import { randomUUID } from 'crypto';

export const items = mssqlTable('items', {
  id: int('id').primaryKey(),
  // Generated in JavaScript at insert time
  publicId: varchar('public_id', { length: 36 }).notNull().$defaultFn(() => randomUUID()),
  slug: varchar('slug', { length: 100 }).$defaultFn(() => generateSlug()),
});
```

**Update defaults ($onUpdate):**

```typescript
export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  updatedAt: datetime2('updated_at').$onUpdate(() => new Date()),
});
```

Use database defaults (`default()`, `defaultNow()`) when possible - they work even for direct SQL inserts. Use `$defaultFn()` when you need JavaScript logic.

---

## 9. Drizzle Relations

**Impact: HIGH** - enables type-safe relational queries

Drizzle relations define relationships between tables for type-safe queries with the relational query API. They are separate from foreign keys - relations are for query building, foreign keys are for database constraints.

**Incorrect (no relations defined):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  authorId: int('author_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
});

// Can't use relational queries without relations defined
// db.query.users.findMany({ with: { posts: true } })  // Error!
```

**Correct (relations defined):**

```typescript
import { mssqlTable, int, varchar } from 'drizzle-orm/mssql-core';
import { relations } from 'drizzle-orm';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  authorId: int('author_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

// Now relational queries work
const result = await db.query.users.findMany({
  with: { posts: true },
});
```

**One-to-one relation:**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const profiles = mssqlTable('profiles', {
  id: int('id').primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  bio: nvarchar('bio', { length: 'max' }),
});

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));
```

**Many-to-many relation:**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
});

export const groups = mssqlTable('groups', {
  id: int('id').primaryKey(),
});

export const usersToGroups = mssqlTable('users_to_groups', {
  userId: int('user_id').notNull().references(() => users.id),
  groupId: int('group_id').notNull().references(() => groups.id),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
]);

export const usersRelations = relations(users, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  user: one(users, { fields: [usersToGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [usersToGroups.groupId], references: [groups.id] }),
}));
```

Relations are TypeScript-only - they don't affect the database schema. Always pair them with actual foreign key constraints for data integrity.
