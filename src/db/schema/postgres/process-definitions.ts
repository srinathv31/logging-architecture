import { pgTable, serial, varchar, text, integer, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const processDefinitions = pgTable(
  'process_definitions',
  {
    processId: serial('process_id').primaryKey(),
    processName: varchar('process_name', { length: 510 }).notNull(),
    displayName: varchar('display_name', { length: 510 }).notNull(),
    description: text('description').notNull(),
    owningTeam: varchar('owning_team', { length: 200 }).notNull(),
    expectedSteps: integer('expected_steps'),
    slaMs: integer('sla_ms'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: false }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('ix_process_definitions_name').on(table.processName),
    index('ix_process_definitions_owning_team').on(table.owningTeam),
  ],
);
