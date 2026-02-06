import { mssqlTable, int, varchar, nvarchar, bit, datetime2 } from 'drizzle-orm/mssql-core';
import { sql } from 'drizzle-orm';

// Indexes managed in drizzle-mssql/manual/001_indexes.sql
export const processDefinitions = mssqlTable('process_definitions', {
  processId: int('process_id').identity().primaryKey(),
  processName: varchar('process_name', { length: 510 }).notNull(),
  displayName: varchar('display_name', { length: 510 }).notNull(),
  description: nvarchar('description', { length: 'max' }).notNull(),
  owningTeam: varchar('owning_team', { length: 200 }).notNull(),
  expectedSteps: int('expected_steps'),
  slaMs: int('sla_ms'),
  isActive: bit('is_active').default(true).notNull(),
  createdAt: datetime2('created_at', { precision: 3 }).default(sql`GETUTCDATE()`).notNull(),
  updatedAt: datetime2('updated_at', { precision: 3 }).default(sql`GETUTCDATE()`).notNull(),
});
