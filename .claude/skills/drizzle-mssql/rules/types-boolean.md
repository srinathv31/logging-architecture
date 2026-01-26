---
title: MSSQL Boolean Type
impact: HIGH
impactDescription: proper boolean handling with MSSQL bit type
tags: mssql, boolean, bit, true, false
---

## MSSQL Boolean Type

MSSQL uses the `bit` type for boolean values. It stores 1 (true), 0 (false), or NULL. Understanding its behavior is important for proper schema design.

**Incorrect (using int for booleans):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  // Using int wastes space and allows invalid values (2, 3, -1, etc.)
  isActive: int('is_active'),
  isVerified: int('is_verified'),
  // Using varchar for boolean
  hasAccess: varchar('has_access', { length: 5 }),  // 'true'/'false'
});
```

**Correct (using bit):**

```typescript
import { mssqlTable, int, bit, varchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  // bit type for booleans - stores true/false
  isActive: bit('is_active').notNull().default(true),
  isVerified: bit('is_verified').notNull().default(false),
  hasAccess: bit('has_access').default(false),
});
```

**Default values:**

```typescript
export const features = mssqlTable('features', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  // Default to true
  isEnabled: bit('is_enabled').notNull().default(true),
  // Default to false
  isDeprecated: bit('is_deprecated').notNull().default(false),
  // Nullable boolean (three-state: true, false, unknown)
  isReviewed: bit('is_reviewed'),  // null = not yet reviewed
});
```

**Querying booleans:**

```typescript
import { eq } from 'drizzle-orm';

// Find active users
const activeUsers = await db
  .select()
  .from(users)
  .where(eq(users.isActive, true));

// Find users not verified
const unverifiedUsers = await db
  .select()
  .from(users)
  .where(eq(users.isVerified, false));

// Check for null (unknown state)
import { isNull } from 'drizzle-orm';
const unreviewedFeatures = await db
  .select()
  .from(features)
  .where(isNull(features.isReviewed));
```

**TypeScript type inference:**

```typescript
export const settings = mssqlTable('settings', {
  id: int('id').primaryKey(),
  // notNull() makes it boolean in TypeScript
  darkMode: bit('dark_mode').notNull(),  // TypeScript: boolean
  // Without notNull(), it's boolean | null
  emailNotifications: bit('email_notifications'),  // TypeScript: boolean | null
});

type Setting = typeof settings.$inferSelect;
// { id: number; darkMode: boolean; emailNotifications: boolean | null }
```

**Guidelines:**
- Always use `bit` for boolean values in MSSQL
- Use `.notNull().default(false)` or `.notNull().default(true)` to avoid null checks
- Use nullable bit only when you need three-state logic (true/false/unknown)
- In queries, compare with `true` or `false`, not with 1 or 0
