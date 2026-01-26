---
title: MSSQL Identity Columns
impact: HIGH
impactDescription: proper auto-incrementing primary keys for MSSQL
tags: mssql, identity, auto-increment, primary-key, sequence
---

## MSSQL Identity Columns

MSSQL uses identity columns for auto-incrementing values. Unlike PostgreSQL's `serial` or MySQL's `AUTO_INCREMENT`, MSSQL requires explicit identity configuration.

**Incorrect (missing identity):**

```typescript
export const users = mssqlTable('users', {
  // This creates a regular int column, not auto-incrementing
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});
// You must manually provide id values on every insert
```

**Correct (with identity):**

```typescript
import { mssqlTable, int, bigint, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  // .identity() makes this an auto-incrementing column
  id: int('id').primaryKey().identity(),
  name: varchar('name', { length: 255 }).notNull(),
});

// Insert without providing id - it's auto-generated
await db.insert(users).values({ name: 'John' });
```

**Identity with seed and increment:**

```typescript
export const products = mssqlTable('products', {
  // Start at 1000, increment by 1
  id: int('id').primaryKey().identity({ seed: 1000, increment: 1 }),
  name: varchar('name', { length: 255 }).notNull(),
});
// First insert will have id = 1000, second = 1001, etc.

export const orders = mssqlTable('orders', {
  // Start at 1, increment by 10 (for potential manual inserts between)
  id: int('id').primaryKey().identity({ seed: 1, increment: 10 }),
  total: decimal('total', { precision: 10, scale: 2 }),
});
// First = 1, second = 11, third = 21, etc.
```

**Bigint identity for large tables:**

```typescript
export const events = mssqlTable('events', {
  // Use bigint for tables expecting billions of rows
  id: bigint('id', { mode: 'number' }).primaryKey().identity(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  timestamp: datetime2('timestamp').notNull().defaultNow(),
});
```

**Non-primary key identity:**

```typescript
export const auditLogs = mssqlTable('audit_logs', {
  // UUID as primary key
  id: uniqueIdentifier('id').primaryKey().default(sql`NEWID()`),
  // Identity for ordering/sequencing (not primary key)
  sequenceNumber: bigint('sequence_number', { mode: 'number' }).identity().notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  timestamp: datetime2('timestamp').notNull().defaultNow(),
});
```

**Important identity behaviors:**

```typescript
// Identity values are NOT reused when rows are deleted
// If you insert id=1,2,3 then delete id=2, next insert is id=4

// To insert explicit values into identity column (rare):
// You must use SET IDENTITY_INSERT ON in raw SQL

// Getting the last inserted identity value:
import { sql } from 'drizzle-orm';
const result = await db.execute(sql`SELECT SCOPE_IDENTITY() as id`);
```

**Identity vs UUID primary keys:**

```typescript
// Identity: Better for clustered index performance
export const internalTable = mssqlTable('internal_table', {
  id: int('id').primaryKey().identity(),
  // ...
});

// UUID: Better for distributed systems, public IDs
export const publicTable = mssqlTable('public_table', {
  // NEWSEQUENTIALID() gives some clustering benefits
  id: uniqueIdentifier('id').primaryKey().default(sql`NEWSEQUENTIALID()`),
  // ...
});

// Hybrid: Best of both worlds
export const hybridTable = mssqlTable('hybrid_table', {
  id: int('id').primaryKey().identity(),  // Internal clustering
  publicId: uniqueIdentifier('public_id').notNull().unique().default(sql`NEWID()`),
  // ...
});
```

**Guidelines:**
- Use `.identity()` for auto-incrementing primary keys
- Default seed is 1 and increment is 1 - only override when needed
- Use `bigint` identity for tables expecting billions of rows
- Identity values are never reused after deletion
- Consider UUID for public-facing IDs, identity for internal keys
