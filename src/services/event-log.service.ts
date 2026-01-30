import {
  eq,
  and,
  sql,
  gte,
  lte,
  or,
  desc,
  asc,
  min,
  max,
  inArray,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/client";
import { eventLogs, correlationLinks } from "../db/schema/index";
import type { EventLogEntry } from "../types/api";
import { calculatePagination } from "../utils/pagination";
import { env } from "../config/env";

/**
 * Formats a search query for MSSQL full-text CONTAINS.
 * Escapes special characters and converts words to prefix search terms.
 */
function formatFullTextQuery(query: string): string {
  const escaped = query.replace(/["\[\]{}()*?\\!]/g, "");
  const words = escaped.trim().split(/\s+/).filter((w) => w.length > 0);
  return words.length === 1
    ? `"${words[0]}*"`
    : words.map((w) => `"${w}*"`).join(" AND ");
}

/**
 * Splits an array into chunks of specified size.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const BATCH_CHUNK_SIZE = 100;

function entryToInsert(entry: EventLogEntry) {
  return {
    correlationId: entry.correlation_id,
    accountId: entry.account_id ?? null,
    traceId: entry.trace_id,
    spanId: entry.span_id,
    parentSpanId: entry.parent_span_id,
    spanLinks: entry.span_links ?? null,
    batchId: entry.batch_id ?? null,
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
      .top(1)
      .from(eventLogs)
      .where(eq(eventLogs.idempotencyKey, entry.idempotency_key));

    if (existing.length > 0) {
      return existing[0];
    }
  }

  // Insert and get the full record using OUTPUT clause
  const [result] = await db
    .insert(eventLogs)
    .output()
    .values(entryToInsert(entry));

  return result;
}

export async function createEvents(entries: EventLogEntry[]) {
  const executionIds: (string | null)[] = new Array(entries.length).fill(null);
  const errors: Array<{ index: number; error: string }> = [];

  await db.transaction(async (tx) => {
    // Collect all idempotency keys and their indices
    const idempotencyMap = new Map<string, number[]>();
    entries.forEach((entry, index) => {
      if (entry.idempotency_key) {
        const indices = idempotencyMap.get(entry.idempotency_key) || [];
        indices.push(index);
        idempotencyMap.set(entry.idempotency_key, indices);
      }
    });

    // Batch check existing idempotency keys
    const existingMap = new Map<string, string>();
    if (idempotencyMap.size > 0) {
      const idempotencyKeys = Array.from(idempotencyMap.keys());
      const keyChunks = chunkArray(idempotencyKeys, BATCH_CHUNK_SIZE);

      for (const keyChunk of keyChunks) {
        const existing = await tx
          .select({
            idempotencyKey: eventLogs.idempotencyKey,
            executionId: eventLogs.executionId,
          })
          .from(eventLogs)
          .where(inArray(eventLogs.idempotencyKey, keyChunk));

        for (const row of existing) {
          if (row.idempotencyKey) {
            existingMap.set(row.idempotencyKey, row.executionId);
          }
        }
      }
    }

    // Partition entries into existing (skip) vs to-insert
    const toInsert: Array<{ index: number; entry: EventLogEntry }> = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.idempotency_key && existingMap.has(entry.idempotency_key)) {
        executionIds[i] = existingMap.get(entry.idempotency_key)!;
      } else {
        toInsert.push({ index: i, entry });
      }
    }

    // Bulk insert in chunks with per-chunk error fallback
    const chunks = chunkArray(toInsert, BATCH_CHUNK_SIZE);
    for (const chunk of chunks) {
      try {
        const results = await tx
          .insert(eventLogs)
          .output({ executionId: eventLogs.executionId })
          .values(chunk.map((c) => entryToInsert(c.entry)));

        results.forEach((row, i) => {
          executionIds[chunk[i].index] = row.executionId;
        });
      } catch {
        // Chunk failed - fall back to individual inserts to identify which rows failed
        for (const item of chunk) {
          try {
            const [result] = await tx
              .insert(eventLogs)
              .output({ executionId: eventLogs.executionId })
              .values(entryToInsert(item.entry));
            executionIds[item.index] = result.executionId;
          } catch (err) {
            errors.push({
              index: item.index,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      }
    }
  });

  // Filter out nulls (failed inserts are in errors array)
  const finalExecutionIds = executionIds.filter(
    (id): id is string => id !== null,
  );

  return { executionIds: finalExecutionIds, errors };
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
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventLogs)
    .where(where);

  const totalCount = countResult.count;
  const { offset, hasMore } = calculatePagination(
    filters.page,
    filters.pageSize,
    totalCount,
  );

  // MSSQL pagination requires ORDER BY before OFFSET/FETCH
  const events = await db
    .select()
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(filters.pageSize);

  return { events, totalCount, hasMore };
}

export async function getByCorrelation(correlationId: string) {
  const events = await db
    .select()
    .from(eventLogs)
    .where(
      and(
        eq(eventLogs.correlationId, correlationId),
        eq(eventLogs.isDeleted, false),
      ),
    )
    .orderBy(asc(eventLogs.stepSequence), asc(eventLogs.eventTimestamp));

  const link = await db
    .select()
    .top(1)
    .from(correlationLinks)
    .where(eq(correlationLinks.correlationId, correlationId));

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
    .orderBy(asc(eventLogs.eventTimestamp));

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
  // Use CONTAINS for full-text search when enabled, otherwise fall back to LIKE
  const searchCondition: SQL =
    env.FULLTEXT_ENABLED === "true"
      ? sql`CONTAINS(${eventLogs.summary}, ${formatFullTextQuery(filters.query)})`
      : sql`${eventLogs.summary} LIKE '%' + ${filters.query} + '%'`;

  const conditions = [eq(eventLogs.isDeleted, false), searchCondition];

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
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventLogs)
    .where(where);

  const totalCount = countResult.count;
  const { offset } = calculatePagination(
    filters.page,
    filters.pageSize,
    totalCount,
  );

  // MSSQL pagination with ORDER BY, OFFSET, FETCH
  const events = await db
    .select()
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(filters.pageSize);

  return { events, totalCount };
}

export async function createBatchUpload(
  batchId: string,
  entries: EventLogEntry[],
) {
  const correlationIds: (string | null)[] = new Array(entries.length).fill(
    null,
  );
  const errors: Array<{ index: number; error: string }> = [];
  let totalInserted = 0;

  await db.transaction(async (tx) => {
    // Collect all idempotency keys and their indices
    const idempotencyMap = new Map<string, number[]>();
    entries.forEach((entry, index) => {
      if (entry.idempotency_key) {
        const indices = idempotencyMap.get(entry.idempotency_key) || [];
        indices.push(index);
        idempotencyMap.set(entry.idempotency_key, indices);
      }
    });

    // Batch check existing idempotency keys
    const existingKeys = new Set<string>();
    if (idempotencyMap.size > 0) {
      const idempotencyKeys = Array.from(idempotencyMap.keys());
      const keyChunks = chunkArray(idempotencyKeys, BATCH_CHUNK_SIZE);

      for (const keyChunk of keyChunks) {
        const existing = await tx
          .select({ idempotencyKey: eventLogs.idempotencyKey })
          .from(eventLogs)
          .where(inArray(eventLogs.idempotencyKey, keyChunk));

        for (const row of existing) {
          if (row.idempotencyKey) {
            existingKeys.add(row.idempotencyKey);
          }
        }
      }
    }

    // Partition entries into existing (skip) vs to-insert
    const toInsert: Array<{ index: number; entry: EventLogEntry }> = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.idempotency_key && existingKeys.has(entry.idempotency_key)) {
        // Already exists - count as inserted and record correlation_id
        correlationIds[i] = entry.correlation_id;
        totalInserted++;
      } else {
        toInsert.push({ index: i, entry });
      }
    }

    // Bulk insert in chunks with per-chunk error fallback
    const chunks = chunkArray(toInsert, BATCH_CHUNK_SIZE);
    for (const chunk of chunks) {
      try {
        await tx.insert(eventLogs).values(
          chunk.map((c) => ({
            ...entryToInsert(c.entry),
            batchId,
          })),
        );

        // Mark all as successful
        for (const item of chunk) {
          correlationIds[item.index] = item.entry.correlation_id;
          totalInserted++;
        }
      } catch {
        // Chunk failed - fall back to individual inserts to identify which rows failed
        for (const item of chunk) {
          try {
            await tx.insert(eventLogs).values({
              ...entryToInsert(item.entry),
              batchId,
            });
            correlationIds[item.index] = item.entry.correlation_id;
            totalInserted++;
          } catch (err) {
            errors.push({
              index: item.index,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      }
    }
  });

  // Filter out nulls and deduplicate correlation IDs
  const uniqueCorrelationIds = [
    ...new Set(correlationIds.filter((id): id is string => id !== null)),
  ];

  return { correlationIds: uniqueCorrelationIds, totalInserted, errors };
}

export async function getByBatch(
  batchId: string,
  filters: {
    eventStatus?: string;
    page: number;
    pageSize: number;
  },
) {
  const conditions = [
    eq(eventLogs.batchId, batchId),
    eq(eventLogs.isDeleted, false),
  ];

  if (filters.eventStatus) {
    conditions.push(eq(eventLogs.eventStatus, filters.eventStatus));
  }

  const where = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventLogs)
    .where(where);

  const totalCount = countResult.count;
  const { offset, hasMore } = calculatePagination(
    filters.page,
    filters.pageSize,
    totalCount,
  );

  // Get aggregate stats (unfiltered by event_status for overall batch stats)
  const batchWhere = and(
    eq(eventLogs.batchId, batchId),
    eq(eventLogs.isDeleted, false),
  );

  // Count distinct correlations by status for accurate stats
  const [stats] = await db
    .select({
      uniqueCorrelationIds: sql<number>`cast(count(distinct ${eventLogs.correlationId}) as int)`,
      successCount: sql<number>`cast(count(distinct case when ${eventLogs.eventStatus} = 'SUCCESS' then ${eventLogs.correlationId} end) as int)`,
      failureCount: sql<number>`cast(count(distinct case when ${eventLogs.eventStatus} = 'FAILURE' then ${eventLogs.correlationId} end) as int)`,
    })
    .from(eventLogs)
    .where(batchWhere);

  // Get paginated events using MSSQL syntax
  const events = await db
    .select()
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(filters.pageSize);

  return {
    events,
    totalCount,
    uniqueCorrelationIds: stats.uniqueCorrelationIds,
    successCount: stats.successCount,
    failureCount: stats.failureCount,
    hasMore,
  };
}

export async function getBatchSummary(batchId: string) {
  const batchWhere = and(
    eq(eventLogs.batchId, batchId),
    eq(eventLogs.isDeleted, false),
  );

  // Count distinct correlations by status for accurate stats
  const [stats] = await db
    .select({
      totalEvents: sql<number>`cast(count(*) as int)`,
      uniqueCorrelations: sql<number>`cast(count(distinct ${eventLogs.correlationId}) as int)`,
      completedCount: sql<number>`cast(count(distinct case when ${eventLogs.eventType} = 'PROCESS_END' and ${eventLogs.eventStatus} = 'SUCCESS' then ${eventLogs.correlationId} end) as int)`,
      failedCount: sql<number>`cast(count(distinct case when ${eventLogs.eventStatus} = 'FAILURE' then ${eventLogs.correlationId} end) as int)`,
      startedAt: min(eventLogs.eventTimestamp),
      lastEventAt: max(eventLogs.eventTimestamp),
    })
    .from(eventLogs)
    .where(batchWhere);

  // Get distinct correlation IDs
  const correlationRows = await db
    .selectDistinct({ correlationId: eventLogs.correlationId })
    .from(eventLogs)
    .where(batchWhere);

  const correlationIds = correlationRows.map((r) => r.correlationId);
  const totalProcesses = stats.uniqueCorrelations;
  const completed = stats.completedCount;
  const failed = stats.failedCount;
  const inProgress = Math.max(0, totalProcesses - completed - failed);

  return {
    totalProcesses,
    completed,
    inProgress,
    failed,
    correlationIds,
    startedAt: stats.startedAt ? stats.startedAt.toISOString() : null,
    lastEventAt: stats.lastEventAt ? stats.lastEventAt.toISOString() : null,
  };
}

export async function deleteAll() {
  await db.delete(eventLogs);
}
