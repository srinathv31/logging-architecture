# Drizzle MSSQL Schema Patterns - Complete Guide

> This document is mainly for agents and LLMs. For the overview and quick reference, see `SKILL.md`.

## Abstract

This guide provides MSSQL-specific patterns for Drizzle ORM schema definition. It covers data types, constraints, and configuration unique to Microsoft SQL Server, complementing the core Drizzle patterns.

## Table of Contents

1. [Integer Types](#1-mssql-integer-types)
2. [String Types](#2-mssql-string-types)
3. [DateTime Types](#3-mssql-datetime-types)
4. [Numeric Types](#4-mssql-numeric-types)
5. [Binary Types](#5-mssql-binary-types)
6. [Boolean Type](#6-mssql-boolean-type)
7. [UUID Type](#7-mssql-uuid-type)
8. [Unique Constraint Limitations](#8-mssql-unique-constraint-limitations)
9. [Identity Columns](#9-mssql-identity-columns)
10. [Connection Pool Setup](#10-mssql-connection-pool-setup)

---

## 1. MSSQL Integer Types

**Impact: HIGH** - ensures correct integer size and JavaScript type handling

MSSQL provides four integer types with different ranges. Choose based on your data requirements and be aware of bigint's JavaScript handling.

**Integer type ranges:**

| Type | Bytes | Range |
|------|-------|-------|
| tinyint | 1 | 0 to 255 |
| smallint | 2 | -32,768 to 32,767 |
| int | 4 | -2,147,483,648 to 2,147,483,647 |
| bigint | 8 | -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807 |

**Incorrect (using int for everything):**

```typescript
export const analytics = mssqlTable('analytics', {
  id: int('id').primaryKey(),
  pageViews: int('page_views'),      // May overflow for high-traffic sites
  userCount: int('user_count'),      // int is fine here
  isActive: int('is_active'),        // Should use bit
  statusCode: int('status_code'),    // Wasteful - smallint is enough
});
```

**Correct (appropriate sizes):**

```typescript
import { mssqlTable, int, bigint, smallint, tinyint, bit } from 'drizzle-orm/mssql-core';

export const analytics = mssqlTable('analytics', {
  id: int('id').primaryKey(),
  pageViews: bigint('page_views', { mode: 'number' }),  // Large counts
  userCount: int('user_count'),                         // Standard integer
  statusCode: smallint('status_code'),                  // HTTP codes (100-599)
  priority: tinyint('priority'),                        // 0-255 range
  isActive: bit('is_active'),                           // Boolean
});
```

**Bigint modes:**

```typescript
// Mode: 'number' - Returns JavaScript number (may lose precision for very large values)
export const stats = mssqlTable('stats', {
  viewCount: bigint('view_count', { mode: 'number' }),  // Returns: number
});

// Mode: 'bigint' - Returns JavaScript BigInt (full precision, requires BigInt handling)
export const ledger = mssqlTable('ledger', {
  amount: bigint('amount', { mode: 'bigint' }),  // Returns: bigint
});

// Mode: 'string' - Returns string (safe for JSON serialization)
export const ids = mssqlTable('ids', {
  externalId: bigint('external_id', { mode: 'string' }),  // Returns: string
});
```

**Guidelines:**
- Use `tinyint` for small positive integers (0-255): flags, ratings, priorities
- Use `smallint` for values up to ~32,000: HTTP codes, years, small counters
- Use `int` for most cases: IDs, counts, standard integers
- Use `bigint` for very large numbers: timestamps in ms, large counters, financial cents
- For `bigint`, use `mode: 'number'` for convenience or `mode: 'bigint'` for precision

---

## 2. MSSQL String Types

**Impact: CRITICAL** - ensures proper Unicode support and prevents unique constraint errors

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

---

## 3. MSSQL DateTime Types

**Impact: HIGH** - ensures proper date/time precision and timezone handling

MSSQL provides several date/time types with different precision and timezone support. Choose based on your precision and timezone requirements.

**DateTime types overview:**

| Type | Range | Precision | Timezone | Size |
|------|-------|-----------|----------|------|
| date | 0001-01-01 to 9999-12-31 | 1 day | No | 3 bytes |
| time | 00:00:00.0000000 to 23:59:59.9999999 | 100ns | No | 3-5 bytes |
| datetime | 1753-01-01 to 9999-12-31 | 3.33ms | No | 8 bytes |
| datetime2 | 0001-01-01 to 9999-12-31 | 100ns | No | 6-8 bytes |
| datetimeoffset | 0001-01-01 to 9999-12-31 | 100ns | Yes | 8-10 bytes |

**Incorrect (using legacy datetime):**

```typescript
export const events = mssqlTable('events', {
  id: int('id').primaryKey(),
  // datetime has limited range (starts 1753) and poor precision (3.33ms)
  createdAt: datetime('created_at'),
  // Missing timezone for global app
  scheduledFor: datetime('scheduled_for'),
  // Using datetime for date-only value - wasteful
  birthDate: datetime('birth_date'),
});
```

**Correct (appropriate types):**

```typescript
import { mssqlTable, int, date, time, datetime2, datetimeoffset } from 'drizzle-orm/mssql-core';

export const events = mssqlTable('events', {
  id: int('id').primaryKey(),
  // datetime2 for timestamps - better range and precision
  createdAt: datetime2('created_at').notNull().defaultNow(),
  updatedAt: datetime2('updated_at').notNull().defaultNow(),
  // datetimeoffset for timezone-aware timestamps
  scheduledFor: datetimeoffset('scheduled_for'),
  // date for date-only values
  birthDate: date('birth_date'),
  // time for time-only values
  startTime: time('start_time'),
});
```

**DateTime modes:**

```typescript
// Mode: 'date' - Returns JavaScript Date object (default)
export const logs = mssqlTable('logs', {
  createdAt: datetime2('created_at', { mode: 'date' }),  // Returns: Date
});

// Mode: 'string' - Returns ISO string (useful for JSON serialization)
export const records = mssqlTable('records', {
  timestamp: datetime2('timestamp', { mode: 'string' }),  // Returns: string
});
```

**Precision options:**

```typescript
export const measurements = mssqlTable('measurements', {
  id: int('id').primaryKey(),
  // datetime2 precision: 0-7 (default 7)
  // Precision 0 = seconds, 7 = 100 nanoseconds
  recordedAt: datetime2('recorded_at', { precision: 3 }),  // Milliseconds
  // time also supports precision
  duration: time('duration', { precision: 0 }),  // Seconds only
});
```

**Default values:**

```typescript
import { sql } from 'drizzle-orm';

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  // .defaultNow() uses GETDATE()
  createdAt: datetime2('created_at').notNull().defaultNow(),
  // Or use SQL expression directly
  publishedAt: datetime2('published_at').default(sql`GETDATE()`),
  // For UTC timestamp
  syncedAt: datetimeoffset('synced_at').default(sql`SYSDATETIMEOFFSET()`),
});
```

**Guidelines:**
- Use `datetime2` instead of `datetime` for new schemas - better range and precision
- Use `datetimeoffset` when timezone information must be preserved
- Use `date` for date-only values (birthdays, holidays) - saves space
- Use `time` for time-only values (schedules, durations)
- Prefer `mode: 'date'` for application logic, `mode: 'string'` for APIs/JSON

---

## 4. MSSQL Numeric Types

**Impact: MEDIUM** - ensures precise decimal calculations and appropriate floating-point usage

MSSQL provides exact numeric types (decimal/numeric) and approximate types (float/real). Choose exact types for financial data and approximate types for scientific calculations.

**Numeric types overview:**

| Type | Precision | Use Case |
|------|-----------|----------|
| decimal(p,s) / numeric(p,s) | Exact, user-defined | Financial, precise calculations |
| float(n) | Approximate, 15 digits | Scientific data, large ranges |
| real | Approximate, 7 digits | Scientific data, smaller precision |

**Incorrect (using float for money):**

```typescript
export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  // NEVER use float for money - rounding errors!
  total: float('total'),
  // Real has even less precision
  tax: real('tax'),
});
// 0.1 + 0.2 !== 0.3 with floating point!
```

**Correct (decimal for money):**

```typescript
import { mssqlTable, int, decimal, float, real } from 'drizzle-orm/mssql-core';

export const orders = mssqlTable('orders', {
  id: int('id').primaryKey(),
  // decimal for exact financial calculations
  // precision 10, scale 2 = up to 99,999,999.99
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 4 }),  // e.g., 0.0825
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
});

export const measurements = mssqlTable('measurements', {
  id: int('id').primaryKey(),
  // float for scientific data where approximation is acceptable
  latitude: float('latitude'),
  longitude: float('longitude'),
  // real for less precision needs
  temperature: real('temperature'),
});
```

**Decimal precision and scale:**

```typescript
// precision = total digits, scale = digits after decimal
export const products = mssqlTable('products', {
  id: int('id').primaryKey(),
  // decimal(10, 2): 10 total digits, 2 after decimal
  // Max: 99,999,999.99
  price: decimal('price', { precision: 10, scale: 2 }),

  // decimal(5, 4): 5 total digits, 4 after decimal
  // Max: 9.9999 (for percentages like 0.0825)
  discountRate: decimal('discount_rate', { precision: 5, scale: 4 }),

  // decimal(19, 4): common for financial applications
  // Max: 999,999,999,999,999.9999
  amount: decimal('amount', { precision: 19, scale: 4 }),
});
```

**Guidelines:**
- Always use `decimal` for money and financial calculations
- Use `decimal` when exact representation matters
- Use `float` for scientific data, coordinates, or when range is more important than precision
- Choose precision and scale based on your maximum expected values
- Remember: decimal is returned as string in Drizzle to preserve precision

---

## 5. MSSQL Binary Types

**Impact: LOW** - proper handling of binary data like files and hashes

MSSQL provides binary types for storing raw byte data such as files, images, hashes, and encrypted data.

**Binary types overview:**

| Type | Length | Use Case |
|------|--------|----------|
| binary(n) | Fixed 1-8,000 bytes | Fixed-size data (hashes, GUIDs as bytes) |
| varbinary(n) | Variable 1-8,000 bytes | Variable-size small binary |
| varbinary(max) | Up to 2GB | Large files, images, documents |

**Incorrect (using string for binary data):**

```typescript
export const files = mssqlTable('files', {
  id: int('id').primaryKey(),
  // Wrong: storing binary as hex string wastes space
  hash: varchar('hash', { length: 64 }),  // SHA-256 as hex
  // Wrong: base64 encoding wastes ~33% more space
  thumbnail: nvarchar('thumbnail', { length: 'max' }),
});
```

**Correct (appropriate binary types):**

```typescript
import { mssqlTable, int, varchar, binary, varbinary } from 'drizzle-orm/mssql-core';

export const files = mssqlTable('files', {
  id: int('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  // binary(32) for SHA-256 hash (32 bytes)
  hash: binary('hash', { length: 32 }),
  // binary(16) for MD5 or UUID as bytes
  checksum: binary('checksum', { length: 16 }),
  // varbinary(max) for file content
  content: varbinary('content', { length: 'max' }),
  // varbinary for small variable binary (thumbnails, icons)
  thumbnail: varbinary('thumbnail', { length: 8000 }),
});
```

**Guidelines:**
- Use `binary(n)` for fixed-size data (hashes, encryption keys)
- Use `varbinary(n)` for variable-size data up to 8KB
- Use `varbinary(max)` for large binary data (files, images)
- Store binary data directly - don't encode to hex/base64 in the database
- Consider storing large files in blob storage with only references in the database

---

## 6. MSSQL Boolean Type

**Impact: HIGH** - proper boolean handling with MSSQL bit type

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

**Guidelines:**
- Always use `bit` for boolean values in MSSQL
- Use `.notNull().default(false)` or `.notNull().default(true)` to avoid null checks
- Use nullable bit only when you need three-state logic (true/false/unknown)
- In queries, compare with `true` or `false`, not with 1 or 0

---

## 7. MSSQL UUID Type

**Impact: HIGH** - proper GUID/UUID handling with uniqueidentifier

MSSQL uses `uniqueidentifier` for storing GUIDs/UUIDs. It's a 16-byte binary type with special handling for generation and comparison.

**Incorrect (using varchar for UUIDs):**

```typescript
export const records = mssqlTable('records', {
  // Storing UUID as string wastes space (36 chars vs 16 bytes)
  id: varchar('id', { length: 36 }).primaryKey(),
  // Inconsistent casing can cause comparison issues
  correlationId: varchar('correlation_id', { length: 36 }),
});
```

**Correct (using uniqueidentifier):**

```typescript
import { mssqlTable, int, uniqueIdentifier, varchar } from 'drizzle-orm/mssql-core';
import { sql } from 'drizzle-orm';

export const records = mssqlTable('records', {
  // uniqueidentifier is the native MSSQL type for UUIDs
  id: uniqueIdentifier('id').primaryKey().default(sql`NEWID()`),
  correlationId: uniqueIdentifier('correlation_id'),
  name: varchar('name', { length: 255 }).notNull(),
});
```

**UUID generation options:**

```typescript
import { sql } from 'drizzle-orm';

export const entities = mssqlTable('entities', {
  // NEWID() - Random UUID (version 4 style)
  id: uniqueIdentifier('id').primaryKey().default(sql`NEWID()`),

  // NEWSEQUENTIALID() - Sequential UUID, better for clustered index performance
  sequentialId: uniqueIdentifier('sequential_id').default(sql`NEWSEQUENTIALID()`),
});
```

**Guidelines:**
- Use `uniqueIdentifier` instead of varchar for UUIDs - saves space and faster comparisons
- Use `NEWID()` for random UUIDs
- Use `NEWSEQUENTIALID()` for clustered primary keys - reduces page splits
- Consider int primary key + UUID public ID for best of both worlds
- UUIDs are case-insensitive in MSSQL

---

## 8. MSSQL Unique Constraint Limitations

**Impact: CRITICAL** - prevents runtime errors from invalid unique constraints

MSSQL cannot create unique constraints or indexes on certain large data types. Attempting to do so will cause a migration error.

**Types that CANNOT have unique constraints:**
- `text`
- `ntext`
- `varchar(max)` / `varchar({ length: 'max' })`
- `nvarchar(max)` / `nvarchar({ length: 'max' })`

**Incorrect (will fail):**

```typescript
export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  // ERROR: Cannot create unique constraint on varchar(max)
  email: varchar('email', { length: 'max' }).unique(),
});

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  // ERROR: Cannot create unique constraint on nvarchar(max)
  slug: nvarchar('slug', { length: 'max' }).unique(),
});
```

**Correct (use bounded length):**

```typescript
import { mssqlTable, int, varchar, nvarchar } from 'drizzle-orm/mssql-core';

export const users = mssqlTable('users', {
  id: int('id').primaryKey(),
  // Use bounded length for columns needing unique constraints
  email: varchar('email', { length: 255 }).notNull().unique(),
});

export const posts = mssqlTable('posts', {
  id: int('id').primaryKey(),
  slug: nvarchar('slug', { length: 200 }).notNull().unique(),
  // nvarchar(max) is fine for content that doesn't need uniqueness
  content: nvarchar('content', { length: 'max' }),
});
```

**Workaround for long text uniqueness:**

```typescript
export const documents = mssqlTable('documents', {
  id: int('id').primaryKey(),
  content: nvarchar('content', { length: 'max' }).notNull(),
  // Store hash for uniqueness checking
  contentHash: binary('content_hash', { length: 32 }).notNull().unique(),
});
```

**Guidelines:**
- Never use `varchar(max)`, `nvarchar(max)`, `text`, or `ntext` with `.unique()`
- Always specify an explicit bounded length for columns needing uniqueness
- Use the smallest practical length - it improves index performance
- For truly large text that needs uniqueness, use a hash column instead

---

## 9. MSSQL Identity Columns

**Impact: HIGH** - proper auto-incrementing primary keys for MSSQL

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
```

**Guidelines:**
- Use `.identity()` for auto-incrementing primary keys
- Default seed is 1 and increment is 1 - only override when needed
- Use `bigint` identity for tables expecting billions of rows
- Identity values are never reused after deletion
- Consider UUID for public-facing IDs, identity for internal keys

---

## 10. MSSQL Connection Pool Setup

**Impact: HIGH** - ensures proper async connection handling and pool management

The node-mssql driver requires async initialization. Drizzle ORM with MSSQL needs proper connection pool setup to avoid runtime errors.

**Incorrect (missing await):**

```typescript
import { drizzle } from 'drizzle-orm/node-mssql';
import mssql from 'mssql';

// Wrong: Pool not awaited before use
const pool = mssql.connect(connectionString);
const db = drizzle({ client: pool });  // pool is a Promise, not a ConnectionPool!
```

**Correct (basic setup):**

```typescript
import { drizzle } from 'drizzle-orm/node-mssql';

// Simplest approach: pass connection string directly
const db = drizzle(process.env.DATABASE_URL!);

// Drizzle handles pool creation internally
const users = await db.select().from(usersTable);
```

**Correct (with existing pool):**

```typescript
import { drizzle } from 'drizzle-orm/node-mssql';
import mssql from 'mssql';

// Must await the pool connection
const pool = await mssql.connect({
  server: 'localhost',
  database: 'mydb',
  user: 'sa',
  password: 'password',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

const db = drizzle({ client: pool });
```

**Application initialization pattern:**

```typescript
// db.ts
import { drizzle } from 'drizzle-orm/node-mssql';
import mssql from 'mssql';
import * as schema from './schema';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: mssql.ConnectionPool | null = null;

export async function getDb() {
  if (db) return db;

  pool = await mssql.connect({
    server: process.env.DB_SERVER!,
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: true,
      trustServerCertificate: process.env.NODE_ENV === 'development',
    },
  });

  db = drizzle({ client: pool, schema });
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.close();
    pool = null;
    db = null;
  }
}
```

**Guidelines:**
- Always await the mssql.connect() before passing to drizzle
- Prefer passing connection string directly for simpler setup
- Use `encrypt: true` for Azure SQL Database
- Use `trustServerCertificate: true` only in development
- Reuse the connection pool across requests - don't create new pools per request
- Close the pool gracefully on application shutdown
