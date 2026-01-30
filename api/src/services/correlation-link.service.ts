import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { correlationLinks } from "../db/schema/index";
import type { CreateCorrelationLinkRequest } from "../types/api";
import { NotFoundError } from "../utils/errors";

export async function createCorrelationLink(
  data: CreateCorrelationLinkRequest,
) {
  // MSSQL doesn't have onConflictDoUpdate, use MERGE via raw SQL
  await db.execute(sql`
    MERGE ${correlationLinks} AS target
    USING (SELECT ${data.correlation_id} AS correlation_id) AS source
    ON target.correlation_id = source.correlation_id
    WHEN MATCHED THEN
      UPDATE SET
        account_id = ${data.account_id},
        application_id = ${data.application_id},
        customer_id = ${data.customer_id ?? null},
        card_number_last4 = ${data.card_number_last4 ?? null}
    WHEN NOT MATCHED THEN
      INSERT (correlation_id, account_id, application_id, customer_id, card_number_last4)
      VALUES (${data.correlation_id}, ${data.account_id}, ${data.application_id}, ${data.customer_id ?? null}, ${data.card_number_last4 ?? null});
  `);

  // Fetch and return the result
  const [result] = await db
    .select()
    .top(1)
    .from(correlationLinks)
    .where(eq(correlationLinks.correlationId, data.correlation_id));

  return result;
}

export async function getCorrelationLink(correlationId: string) {
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
