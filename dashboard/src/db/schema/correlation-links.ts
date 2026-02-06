import { mssqlTable, varchar, datetime2 } from "drizzle-orm/mssql-core";
import { sql } from "drizzle-orm";

// Indexes managed in drizzle-mssql/manual/001_indexes.sql
export const correlationLinks = mssqlTable("correlation_links", {
  correlationId: varchar("correlation_id", { length: 200 }).primaryKey(),
  accountId: varchar("account_id", { length: 64 }).notNull(),
  applicationId: varchar("application_id", { length: 100 }),
  customerId: varchar("customer_id", { length: 100 }),
  cardNumberLast4: varchar("card_number_last4", { length: 4 }),
  linkedAt: datetime2("linked_at", { precision: 3 })
    .default(sql`GETUTCDATE()`)
    .notNull(),
});
