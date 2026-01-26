---
title: MSSQL DateTime Types
impact: HIGH
impactDescription: ensures proper date/time precision and timezone handling
tags: mssql, datetime, datetime2, date, time, datetimeoffset, timestamp
---

## MSSQL DateTime Types

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
