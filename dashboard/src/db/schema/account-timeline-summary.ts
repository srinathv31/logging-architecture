import { pgTable, varchar, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const accountTimelineSummary = pgTable(
  'account_timeline_summary',
  {
    accountId: varchar('account_id', { length: 64 }).primaryKey(),
    firstEventAt: timestamp('first_event_at', { withTimezone: false }).notNull(),
    lastEventAt: timestamp('last_event_at', { withTimezone: false }).notNull(),
    totalEvents: integer('total_events').notNull(),
    totalProcesses: integer('total_processes').notNull(),
    errorCount: integer('error_count').default(0).notNull(),
    lastProcess: varchar('last_process', { length: 510 }),
    systemsTouched: jsonb('systems_touched').$type<string[]>(),
    correlationIds: jsonb('correlation_ids').$type<string[]>(),
    updatedAt: timestamp('updated_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_account_timeline_summary_last_event').on(sql`${table.lastEventAt} DESC`),
  ],
);
