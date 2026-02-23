import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { correlationLinks } from "../db/schema/index";
import type { CreateCorrelationLinkRequest } from "../types/api";
import { NotFoundError } from "../utils/errors";

export async function createCorrelationLink(
  data: CreateCorrelationLinkRequest,
) {
  const db = await getDb();
  // MSSQL doesn't have onConflictDoUpdate, use MERGE via raw SQL
  await db.execute(sql`
    MERGE ${correlationLinks} AS target
    USING (SELECT ${data.correlationId} AS correlation_id) AS source
    ON target.correlation_id = source.correlation_id
    WHEN MATCHED THEN
      UPDATE SET
        account_id = ${data.accountId},
        application_id = ${data.applicationId ?? null},
        customer_id = ${data.customerId ?? null},
        card_number_last4 = ${data.cardNumberLast4 ?? null}
    WHEN NOT MATCHED THEN
      INSERT (correlation_id, account_id, application_id, customer_id, card_number_last4)
      VALUES (${data.correlationId}, ${data.accountId}, ${data.applicationId ?? null}, ${data.customerId ?? null}, ${data.cardNumberLast4 ?? null});
  `);

  // Fetch and return the result
  const [result] = await db
    .select()
    .top(1)
    .from(correlationLinks)
    .where(eq(correlationLinks.correlationId, data.correlationId));

  return result;
}

export async function getCorrelationLink(correlationId: string) {
  const db = await getDb();
  const [link] = await db
    .select()
    .top(1)
    .from(correlationLinks)
    .where(eq(correlationLinks.correlationId, correlationId));

  if (!link) {
    throw new NotFoundError(
      `Correlation link not found for correlation_id: ${correlationId}`,
    );
  }

  return link;
}
