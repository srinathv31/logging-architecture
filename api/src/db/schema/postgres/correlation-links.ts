import { pgTable, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const correlationLinks = pgTable(
  'correlation_links',
  {
    correlationId: varchar('correlation_id', { length: 200 }).primaryKey(),
    accountId: varchar('account_id', { length: 64 }).notNull(),
    applicationId: varchar('application_id', { length: 100 }),
    customerId: varchar('customer_id', { length: 100 }),
    cardNumberLast4: varchar('card_number_last4', { length: 4 }),
    linkedAt: timestamp('linked_at', { withTimezone: false }).defaultNow().notNull(),
  },
  (table) => [
    index('ix_correlation_links_account_id').on(table.accountId),
    index('ix_correlation_links_application_id')
      .on(table.applicationId)
      .where(sql`${table.applicationId} IS NOT NULL`),
  ],
);
