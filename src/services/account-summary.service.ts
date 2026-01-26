import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { accountTimelineSummary, eventLogs } from '../db/schema/index';
import { NotFoundError } from '../utils/errors';

export async function getAccountSummary(accountId: string) {
  const [summary] = await db
    .select()
    .from(accountTimelineSummary)
    .where(eq(accountTimelineSummary.accountId, accountId))
    .limit(1);

  if (!summary) {
    throw new NotFoundError(`Account summary not found for account_id: ${accountId}`);
  }

  const recentEvents = await db
    .select()
    .from(eventLogs)
    .where(and(eq(eventLogs.accountId, accountId), eq(eventLogs.isDeleted, false)))
    .orderBy(desc(eventLogs.eventTimestamp))
    .limit(10);

  const recentErrors = await db
    .select()
    .from(eventLogs)
    .where(
      and(
        eq(eventLogs.accountId, accountId),
        eq(eventLogs.eventStatus, 'FAILURE'),
        eq(eventLogs.isDeleted, false),
      ),
    )
    .orderBy(desc(eventLogs.eventTimestamp))
    .limit(5);

  return { summary, recentEvents, recentErrors };
}
