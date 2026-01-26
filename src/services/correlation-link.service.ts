import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { correlationLinks } from '../db/schema/index';
import type { CreateCorrelationLinkRequest } from '../types/api';
import { NotFoundError } from '../utils/errors';

export async function createCorrelationLink(data: CreateCorrelationLinkRequest) {
  const [result] = await db
    .insert(correlationLinks)
    .values({
      correlationId: data.correlation_id,
      accountId: data.account_id,
      applicationId: data.application_id,
      customerId: data.customer_id,
      cardNumberLast4: data.card_number_last4,
    })
    .onConflictDoUpdate({
      target: correlationLinks.correlationId,
      set: {
        accountId: data.account_id,
        applicationId: data.application_id,
        customerId: data.customer_id,
        cardNumberLast4: data.card_number_last4,
      },
    })
    .returning();

  return result;
}

export async function getCorrelationLink(correlationId: string) {
  const [link] = await db
    .select()
    .from(correlationLinks)
    .where(eq(correlationLinks.correlationId, correlationId))
    .limit(1);

  if (!link) {
    throw new NotFoundError(`Correlation link not found for correlation_id: ${correlationId}`);
  }

  return link;
}
