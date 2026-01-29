import { mssqlTable, varchar, datetime2, int, nvarchar, index } from 'drizzle-orm/mssql-core';
import { sql } from 'drizzle-orm';

export const accountTimelineSummary = mssqlTable(
  'account_timeline_summary',
  {
    accountId: varchar('account_id', { length: 64 }).primaryKey(),
    firstEventAt: datetime2('first_event_at', { precision: 3 }).notNull(),
    lastEventAt: datetime2('last_event_at', { precision: 3 }).notNull(),
    totalEvents: int('total_events').notNull(),
    totalProcesses: int('total_processes').notNull(),
    errorCount: int('error_count').default(0).notNull(),
    lastProcess: varchar('last_process', { length: 510 }),
    systemsTouched: nvarchar('systems_touched', { length: 'max', mode: 'json' }).$type<string[]>(),
    correlationIds: nvarchar('correlation_ids', { length: 'max', mode: 'json' }).$type<string[]>(),
    updatedAt: datetime2('updated_at', { precision: 3 }).default(sql`GETUTCDATE()`).notNull(),
  },
  (table) => [
    index('ix_account_timeline_summary_last_event').on(table.lastEventAt),
  ],
);
