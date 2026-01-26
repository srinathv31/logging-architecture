---
title: MSSQL String Types
impact: CRITICAL
impactDescription: ensures proper Unicode support and prevents unique constraint errors
tags: mssql, string, varchar, nvarchar, char, nchar, text, unicode
---

## MSSQL String Types

MSSQL offers ASCII and Unicode string types. The `n` prefix (nvarchar, nchar, ntext) indicates Unicode support. Choose carefully based on internationalization needs and constraint requirements.

**String types overview:**

| Type | Unicode | Max Length | Use Case |
|------|---------|------------|----------|
| char(n) | No | 8,000 | Fixed-length ASCII (codes, identifiers) |
| varchar(n) | No | 8,000 | Variable ASCII text |
| varchar(max) | No | 2GB | Large ASCII text (no unique/index) |
| nchar(n) | Yes | 4,000 | Fixed-length Unicode |
| nvarchar(n) | Yes | 4,000 | Variable Unicode text |
| nvarchar(max) | Yes | 2GB | Large Unicode text (no unique/index) |
| text | No | 2GB | Legacy - avoid, use varchar(max) |
| ntext | Yes | 2GB | Legacy - avoid, use nvarchar(max) |

**Incorrect (wrong type choices):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  // ASCII only - won't store international names correctly
  name: varchar('name', { length: 255 }),
  // Can't add unique constraint on max length
  email: varchar('email', { length: 'max' }).unique(),  // Error!
  // Using deprecated text type
  bio: text('bio'),
});
```

**Correct (appropriate types):**

```typescript
import { mssqlTable, int, varchar, nvarchar, char } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  // Unicode for international names
  name: nvarchar('name', { length: 255 }).notNull(),
  // Bounded length allows unique constraint
  email: varchar('email', { length: 255 }).notNull().unique(),
  // nvarchar(max) for large Unicode content (no unique needed)
  bio: nvarchar('bio', { length: 'max' }),
  // Fixed-length for codes
  countryCode: char('country_code', { length: 2 }),
  // Fixed-length Unicode for currency symbols
  currencySymbol: nchar('currency_symbol', { length: 1 }),
});
```

**Using enum for type safety:**

```typescript
export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  // TypeScript enum constraint (not enforced in DB)
  status: varchar('status', { length: 20, enum: ['pending', 'processing', 'shipped', 'delivered'] }),
});
// status will be typed as 'pending' | 'processing' | 'shipped' | 'delivered'
```

**JSON storage with nvarchar:**

```typescript
export const settings = mssqlTable('settings', {
  id: int('id').primaryKey(),
  // Use nvarchar for JSON to support Unicode content
  config: nvarchar('config', { length: 'max', mode: 'json' }).$type<{
    theme: string;
    notifications: boolean;
  }>(),
});
```

**Guidelines:**
- Use `nvarchar` for user-facing text that may contain international characters
- Use `varchar` for ASCII-only data (URLs, codes, internal identifiers)
- Always specify explicit length - avoid defaulting to max when bounded length works
- Never use `text` or `ntext` - they're deprecated; use `varchar(max)` or `nvarchar(max)`
- Remember: `varchar(max)` and `nvarchar(max)` cannot have unique constraints or indexes
