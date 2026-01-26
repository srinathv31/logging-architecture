import { eq, and, sql, gte, lte, or, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { eventLogs, correlationLinks } from '../db/schema/index';
import type { EventLogEntry } from '../types/api';
import { calculatePagination } from '../utils/pagination';

function entryToInsert(entry: EventLogEntry) {
  return {
    correlationId: entry.correlation_id,
    accountId: entry.account_id ?? null,
    traceId: entry.trace_id,
    spanId: entry.span_id,
    parentSpanId: entry.parent_span_id,
    applicationId: entry.application_id,
    targetSystem: entry.target_system,
    originatingSystem: entry.originating_system,
    processName: entry.process_name,
    stepSequence: entry.step_sequence,
    stepName: entry.step_name,
    eventType: entry.event_type,
    eventStatus: entry.event_status,
    identifiers: entry.identifiers,
    summary: entry.summary,
    result: entry.result,
    metadata: entry.metadata,
    eventTimestamp: new Date(entry.event_timestamp),
    executionTimeMs: entry.execution_time_ms,
    endpoint: entry.endpoint,
    httpMethod: entry.http_method,
    httpStatusCode: entry.http_status_code,
    errorCode: entry.error_code,
    errorMessage: entry.error_message,
    requestPayload: entry.request_payload,
    responsePayload: entry.response_payload,
    idempotencyKey: entry.idempotency_key,
  };
}

export async function createEvent(entry: EventLogEntry) {
  // If idempotency_key is provided, check for existing record
  if (entry.idempotency_key) {
    const existing = await db
      .select()
      .from(eventLogs)
      .where(eq(eventLogs.idempotencyKey, entry.idempotency_key))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }
  }

  const [result] = await db
    .insert(eventLogs)
    .values(entryToInsert(entry))
    .returning();

  return result;
}

export async function createEvents(entries: EventLogEntry[]) {
  const executionIds: string[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  await db.transaction(async (tx) => {
    for (let i = 0; i < entries.length; i++) {
      try {
        const entry = entries[i];

        // Idempotency check within batch
        if (entry.idempotency_key) {
          const existing = await tx
            .select({ executionId: eventLogs.executionId })
            .from(eventLogs)
            .where(eq(eventLogs.idempotencyKey, entry.idempotency_key))
            .limit(1);

          if (existing.length > 0) {
            executionIds.push(existing[0].executionId);
            continue;
          }
        }

        const [result] = await tx
          .insert(eventLogs)
          .values(entryToInsert(entry))
          .returning({ executionId: eventLogs.executionId });

        executionIds.push(result.executionId);
      } catch (err) {
        errors.push({
          index: i,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  });

  return { executionIds, errors };
}

export async function getByAccount(
  accountId: string,
  filters: {
    startDate?: string;
    endDate?: string;
    processName?: string;
    eventStatus?: string;
    includeLinked?: boolean;
    page: number;
    pageSize: number;
  },
) {
  const conditions = [eq(eventLogs.isDeleted, false)];

  if (filters.includeLinked) {
    // Include events where account_id matches OR events linked via correlation_links
    // We'll handle this with a subquery approach
    const linkedCorrelationIds = db
      .select({ correlationId: correlationLinks.correlationId })
      .from(correlationLinks)
      .where(eq(correlationLinks.accountId, accountId));

    conditions.push(
      or(
        eq(eventLogs.accountId, accountId),
        sql`${eventLogs.correlationId} IN (${linkedCorrelationIds})`,
      )!,
    );
  } else {
    conditions.push(eq(eventLogs.accountId, accountId));
  }

  if (filters.startDate) {
    conditions.push(gte(eventLogs.eventTimestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(eventLogs.eventTimestamp, new Date(filters.endDate)));
  }
  if (filters.processName) {
    conditions.push(eq(eventLogs.processName, filters.processName));
  }
  if (filters.eventStatus) {
    conditions.push(eq(eventLogs.eventStatus, filters.eventStatus));
  }

  const where = and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(eventLogs)
    .where(where);

  const totalCount = countResult.count;
  const { offset, hasMore } = calculatePagination(filters.page, filters.pageSize, totalCount);

  const events = await db
    .select()
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.eventTimestamp))
    .limit(filters.pageSize)
    .offset(offset);

  return { events, totalCount, hasMore };
}

export async function getByCorrelation(correlationId: string) {
  const events = await db
    .select()
    .from(eventLogs)
    .where(and(eq(eventLogs.correlationId, correlationId), eq(eventLogs.isDeleted, false)))
    .orderBy(eventLogs.stepSequence, eventLogs.eventTimestamp);

  const link = await db
    .select()
    .from(correlationLinks)
    .where(eq(correlationLinks.correlationId, correlationId))
    .limit(1);

  return {
    events,
    accountId: link.length > 0 ? link[0].accountId : null,
    isLinked: link.length > 0,
  };
}

export async function getByTrace(traceId: string) {
  const events = await db
    .select()
    .from(eventLogs)
    .where(and(eq(eventLogs.traceId, traceId), eq(eventLogs.isDeleted, false)))
    .orderBy(eventLogs.eventTimestamp);

  const systemsInvolved = [...new Set(events.map((e) => e.targetSystem))];

  let totalDurationMs: number | null = null;
  if (events.length > 0) {
    const first = events[0].eventTimestamp;
    const last = events[events.length - 1].eventTimestamp;
    totalDurationMs = last.getTime() - first.getTime();
  }

  return { events, systemsInvolved, totalDurationMs };
}

export async function searchText(filters: {
  query: string;
  accountId?: string;
  processName?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const conditions = [
    eq(eventLogs.isDeleted, false),
    sql`to_tsvector('english', ${eventLogs.summary}) @@ plainto_tsquery('english', ${filters.query})`,
  ];

  if (filters.accountId) {
    conditions.push(eq(eventLogs.accountId, filters.accountId));
  }
  if (filters.processName) {
    conditions.push(eq(eventLogs.processName, filters.processName));
  }
  if (filters.startDate) {
    conditions.push(gte(eventLogs.eventTimestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(eventLogs.eventTimestamp, new Date(filters.endDate)));
  }

  const where = and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(eventLogs)
    .where(where);

  const totalCount = countResult.count;
  const { offset } = calculatePagination(filters.page, filters.pageSize, totalCount);

  const events = await db
    .select()
    .from(eventLogs)
    .where(where)
    .orderBy(
      sql`ts_rank(to_tsvector('english', ${eventLogs.summary}), plainto_tsquery('english', ${filters.query})) DESC`,
    )
    .limit(filters.pageSize)
    .offset(offset);

  return { events, totalCount };
}
