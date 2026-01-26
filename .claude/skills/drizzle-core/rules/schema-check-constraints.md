---
title: Check Constraints
impact: MEDIUM
impactDescription: enforces data validation at database level
tags: schema, check, constraint, validation
---

## Check Constraints

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
