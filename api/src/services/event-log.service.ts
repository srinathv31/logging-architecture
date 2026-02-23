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
  getColumns,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../db/client";
import { eventLogs, correlationLinks } from "../db/schema/index";
import type { EventLogEntry } from "../types/api";
import { chunkArray } from "../utils/array";
import { formatFullTextQuery } from "../utils/search";
import { env } from "../config/env";

const BATCH_CHUNK_SIZE = 100;

async function getTotalCountFromPaginatedRows(
  db: Awaited<ReturnType<typeof getDb>>,
  where: SQL | undefined,
  rows: Array<{ _totalCount: number }>,
  offset: number,
) {
  if (rows.length > 0) {
    return rows[0]._totalCount;
  }

  if (offset === 0) {
    return 0;
  }

  const [countRow] = await db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(eventLogs)
    .where(where);

  return countRow?.count ?? 0;
}

function entryToInsert(entry: EventLogEntry) {
  return {
    correlationId: entry.correlationId,
    accountId: entry.accountId ?? null,
    traceId: entry.traceId,
    spanId: entry.spanId,
    parentSpanId: entry.parentSpanId,
    spanLinks: entry.spanLinks ?? null,
    batchId: entry.batchId ?? null,
    applicationId: entry.applicationId,
    targetSystem: entry.targetSystem,
    originatingSystem: entry.originatingSystem,
    processName: entry.processName,
    stepSequence: entry.stepSequence,
    stepName: entry.stepName,
    eventType: entry.eventType,
    eventStatus: entry.eventStatus,
    identifiers: entry.identifiers,
    summary: entry.summary,
    result: entry.result,
    metadata: entry.metadata,
    eventTimestamp: new Date(entry.eventTimestamp),
    executionTimeMs: entry.executionTimeMs,
    endpoint: entry.endpoint,
    httpMethod: entry.httpMethod,
    httpStatusCode: entry.httpStatusCode,
    errorCode: entry.errorCode,
    errorMessage: entry.errorMessage,
    requestPayload: entry.requestPayload,
    responsePayload: entry.responsePayload,
    idempotencyKey: entry.idempotencyKey,
  };
}

export async function createEvent(entry: EventLogEntry) {
  const db = await getDb();

  // If idempotencyKey is provided, check for existing record
  if (entry.idempotencyKey) {
    const existing = await db
      .select()
      .top(1)
      .from(eventLogs)
      .where(eq(eventLogs.idempotencyKey, entry.idempotencyKey));

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
  const db = await getDb();
  const executionIds: (string | null)[] = new Array(entries.length).fill(null);
  const errors: Array<{ index: number; error: string }> = [];

  await db.transaction(async (tx) => {
    // Collect all idempotency keys and their indices
    const idempotencyMap = new Map<string, number[]>();
    entries.forEach((entry, index) => {
      if (entry.idempotencyKey) {
        const indices = idempotencyMap.get(entry.idempotencyKey) || [];
        indices.push(index);
        idempotencyMap.set(entry.idempotencyKey, indices);
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
      if (entry.idempotencyKey && existingMap.has(entry.idempotencyKey)) {
        executionIds[i] = existingMap.get(entry.idempotencyKey)!;
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
  const db = await getDb();
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
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await db
    .select({
      ...getColumns(eventLogs),
      _totalCount: sql<number>`cast(count(*) over() as int)`,
    })
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(filters.pageSize);

  const totalCount = await getTotalCountFromPaginatedRows(db, where, rows, offset);
  const hasMore = offset + filters.pageSize < totalCount;
  const events = rows.map(({ _totalCount, ...event }) => event);

  return { events, totalCount, hasMore };
}

export async function lookupEvents(filters: {
  accountId?: string;
  processName?: string;
  eventStatus?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  const conditions: SQL[] = [eq(eventLogs.isDeleted, false)];

  if (filters.accountId) {
    conditions.push(eq(eventLogs.accountId, filters.accountId));
  }
  if (filters.processName) {
    conditions.push(eq(eventLogs.processName, filters.processName));
  }
  if (filters.eventStatus) {
    conditions.push(eq(eventLogs.eventStatus, filters.eventStatus));
  }
  if (filters.startDate) {
    conditions.push(gte(eventLogs.eventTimestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(eventLogs.eventTimestamp, new Date(filters.endDate)));
  }

  const where = and(...conditions);
  if (!where) {
    throw new Error("lookupEvents requires at least one condition");
  }
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await db
    .select({
      ...getColumns(eventLogs),
      _totalCount: sql<number>`cast(count(*) over() as int)`,
    })
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(filters.pageSize);

  const totalCount = await getTotalCountFromPaginatedRows(db, where, rows, offset);
  const hasMore = offset + filters.pageSize < totalCount;
  const events = rows.map(({ _totalCount, ...event }) => event);

  return { events, totalCount, hasMore };
}

export async function getByCorrelation(
  correlationId: string,
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 200 },
) {
  const db = await getDb();
  const offset = (pagination.page - 1) * pagination.pageSize;
  const where = and(
    eq(eventLogs.correlationId, correlationId),
    eq(eventLogs.isDeleted, false),
  );

  const rows = await db
    .select({
      ...getColumns(eventLogs),
      _totalCount: sql<number>`cast(count(*) over() as int)`,
    })
    .from(eventLogs)
    .where(where)
    .orderBy(asc(eventLogs.stepSequence), asc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(pagination.pageSize);

  const totalCount = await getTotalCountFromPaginatedRows(db, where, rows, offset);
  const hasMore = offset + pagination.pageSize < totalCount;
  const events = rows.map(({ _totalCount, ...event }) => event);

  const link = await db
    .select()
    .top(1)
    .from(correlationLinks)
    .where(eq(correlationLinks.correlationId, correlationId));

  return {
    events,
    accountId: link.length > 0 ? link[0].accountId : null,
    isLinked: link.length > 0,
    totalCount,
    hasMore,
  };
}

export async function getByTrace(
  traceId: string,
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 200 },
) {
  const db = await getDb();
  const where = and(eq(eventLogs.traceId, traceId), eq(eventLogs.isDeleted, false));

  // Aggregate queries for systems involved and total duration (over full dataset)
  const systemRows = await db
    .selectDistinct({ targetSystem: eventLogs.targetSystem })
    .from(eventLogs)
    .where(where);
  const systemsInvolved = [
    ...new Set(
      systemRows
        .map((r) => r.targetSystem)
        .filter(
          (targetSystem): targetSystem is string =>
            typeof targetSystem === "string" && targetSystem.length > 0,
        ),
    ),
  ];

  const [agg] = await db
    .select({
      firstEventAt: min(eventLogs.eventTimestamp),
      lastEventAt: max(eventLogs.eventTimestamp),
      successCount: sql<number>`cast(sum(case when ${eventLogs.eventStatus} = 'SUCCESS' then 1 else 0 end) as int)`,
      failureCount: sql<number>`cast(sum(case when ${eventLogs.eventStatus} = 'FAILURE' then 1 else 0 end) as int)`,
      inProgressCount: sql<number>`cast(sum(case when ${eventLogs.eventStatus} = 'IN_PROGRESS' then 1 else 0 end) as int)`,
      skippedCount: sql<number>`cast(sum(case when ${eventLogs.eventStatus} = 'SKIPPED' then 1 else 0 end) as int)`,
      processName: sql<string | null>`min(case when ${eventLogs.eventType} = 'PROCESS_START' then ${eventLogs.processName} end)`,
      accountId: sql<string | null>`min(${eventLogs.accountId})`,
    })
    .from(eventLogs)
    .where(where);
  const totalDurationMs =
    agg.firstEventAt && agg.lastEventAt
      ? Math.max(0, agg.lastEventAt.getTime() - agg.firstEventAt.getTime())
      : null;

  // Paginated data query with count(*) over()
  const offset = (pagination.page - 1) * pagination.pageSize;

  const rows = await db
    .select({
      ...getColumns(eventLogs),
      _totalCount: sql<number>`cast(count(*) over() as int)`,
    })
    .from(eventLogs)
    .where(where)
    .orderBy(asc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(pagination.pageSize);

  const totalCount = await getTotalCountFromPaginatedRows(db, where, rows, offset);
  const hasMore = offset + pagination.pageSize < totalCount;
  const events = rows.map(({ _totalCount, ...event }) => event);

  return {
    events,
    systemsInvolved,
    totalDurationMs,
    totalCount,
    hasMore,
    statusCounts: {
      success: agg.successCount ?? 0,
      failure: agg.failureCount ?? 0,
      inProgress: agg.inProgressCount ?? 0,
      skipped: agg.skippedCount ?? 0,
    },
    processName: agg.processName ?? null,
    accountId: agg.accountId ?? null,
    startTime: agg.firstEventAt ? agg.firstEventAt.toISOString() : null,
    endTime: agg.lastEventAt ? agg.lastEventAt.toISOString() : null,
  };
}

export async function listTraces(filters: {
  startDate?: string;
  endDate?: string;
  processName?: string;
  eventStatus?: string;
  accountId?: string;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  const conditions: SQL[] = [eq(eventLogs.isDeleted, false)];

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
  if (filters.accountId) {
    conditions.push(eq(eventLogs.accountId, filters.accountId));
  }

  const where = and(...conditions);
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await db
    .select({
      traceId: eventLogs.traceId,
      eventCount: sql<number>`cast(count(*) as int)`,
      errorCount: sql<number>`cast(sum(case when ${eventLogs.eventStatus} = 'FAILURE' then 1 else 0 end) as int)`,
      latestStatus: sql<string>`(select top 1 e2.event_status from [event_log] e2 where e2.trace_id = ${eventLogs.traceId} and e2.is_deleted = 0 order by e2.event_timestamp desc)`,
      startTime: min(eventLogs.eventTimestamp),
      endTime: max(eventLogs.eventTimestamp),
      processName: sql<string | null>`min(case when ${eventLogs.eventType} = 'PROCESS_START' then ${eventLogs.processName} end)`,
      accountId: sql<string | null>`min(${eventLogs.accountId})`,
      _totalCount: sql<number>`cast(count(*) over() as int)`,
    })
    .from(eventLogs)
    .where(where)
    .groupBy(eventLogs.traceId)
    .orderBy(sql`max(${eventLogs.eventTimestamp}) desc`)
    .offset(offset)
    .fetch(filters.pageSize);

  let totalCount: number;
  if (rows.length > 0) {
    totalCount = rows[0]._totalCount;
  } else if (offset === 0) {
    totalCount = 0;
  } else {
    const [countRow] = await db
      .select({
        count: sql<number>`cast(count(distinct ${eventLogs.traceId}) as int)`,
      })
      .from(eventLogs)
      .where(where);
    totalCount = countRow?.count ?? 0;
  }

  const hasMore = offset + filters.pageSize < totalCount;

  const traces = rows.map(({ _totalCount, startTime, endTime, errorCount, ...row }) => ({
    traceId: row.traceId,
    eventCount: row.eventCount,
    hasErrors: errorCount > 0,
    latestStatus: row.latestStatus,
    durationMs:
      startTime && endTime
        ? Math.max(0, endTime.getTime() - startTime.getTime())
        : null,
    processName: row.processName ?? null,
    accountId: row.accountId ?? null,
    startTime: startTime ? startTime.toISOString() : '',
    endTime: endTime ? endTime.toISOString() : '',
  }));

  return { traces, totalCount, hasMore };
}

export async function getDashboardStats(filters: {
  startDate?: string;
  endDate?: string;
} = {}) {
  const db = await getDb();
  const conditions: SQL[] = [eq(eventLogs.isDeleted, false)];

  if (filters.startDate) {
    conditions.push(gte(eventLogs.eventTimestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    conditions.push(lte(eventLogs.eventTimestamp, new Date(filters.endDate)));
  }

  const where = and(...conditions);

  const [stats] = await db
    .select({
      totalTraces: sql<number>`cast(count(distinct ${eventLogs.traceId}) as int)`,
      totalAccounts: sql<number>`cast(count(distinct case when ${eventLogs.accountId} is not null then ${eventLogs.accountId} end) as int)`,
      totalEvents: sql<number>`cast(count(*) as int)`,
      tracesWithFailures: sql<number>`cast(count(distinct case when ${eventLogs.eventStatus} = 'FAILURE' then ${eventLogs.traceId} end) as int)`,
    })
    .from(eventLogs)
    .where(where);

  const systemRows = await db
    .selectDistinct({ targetSystem: eventLogs.targetSystem })
    .from(eventLogs)
    .where(where);

  const systemNames = systemRows
    .map((r) => r.targetSystem)
    .filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );

  const totalTraces = stats.totalTraces ?? 0;
  const tracesWithFailures = stats.tracesWithFailures ?? 0;
  const successRate =
    totalTraces > 0
      ? Math.round(((totalTraces - tracesWithFailures) / totalTraces) * 10000) / 100
      : 100;

  return {
    totalTraces,
    totalAccounts: stats.totalAccounts ?? 0,
    totalEvents: stats.totalEvents ?? 0,
    successRate,
    systemNames,
  };
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
  const db = await getDb();
  const fullTextEnabled = env.FULLTEXT_ENABLED === "true";
  const baseConditions: SQL[] = [eq(eventLogs.isDeleted, false)];

  if (filters.accountId) {
    baseConditions.push(eq(eventLogs.accountId, filters.accountId));
  }
  if (filters.processName) {
    baseConditions.push(eq(eventLogs.processName, filters.processName));
  }
  if (filters.startDate) {
    baseConditions.push(gte(eventLogs.eventTimestamp, new Date(filters.startDate)));
  }
  if (filters.endDate) {
    baseConditions.push(lte(eventLogs.eventTimestamp, new Date(filters.endDate)));
  }

  const buildWhere = (useFullText: boolean) => {
    const searchCondition: SQL = useFullText
      ? sql`CONTAINS(${eventLogs.summary}, ${formatFullTextQuery(filters.query)})`
      : sql`${eventLogs.summary} LIKE '%' + ${filters.query} + '%'`;
    const where = and(...baseConditions, searchCondition);
    if (!where) {
      throw new Error("searchText requires at least one condition");
    }
    return where;
  };

  const offset = (filters.page - 1) * filters.pageSize;
  const where = buildWhere(fullTextEnabled);

  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventLogs)
    .where(where);

  const totalCount = countResult?.count ?? 0;
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
  const db = await getDb();
  const correlationIds: (string | null)[] = new Array(entries.length).fill(
    null,
  );
  const errors: Array<{ index: number; error: string }> = [];
  let totalInserted = 0;

  await db.transaction(async (tx) => {
    // Collect all idempotency keys and their indices
    const idempotencyMap = new Map<string, number[]>();
    entries.forEach((entry, index) => {
      if (entry.idempotencyKey) {
        const indices = idempotencyMap.get(entry.idempotencyKey) || [];
        indices.push(index);
        idempotencyMap.set(entry.idempotencyKey, indices);
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
      if (entry.idempotencyKey && existingKeys.has(entry.idempotencyKey)) {
        // Already exists - count as inserted and record correlation_id
        correlationIds[i] = entry.correlationId;
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
          correlationIds[item.index] = item.entry.correlationId;
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
            correlationIds[item.index] = item.entry.correlationId;
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
  const db = await getDb();
  const conditions = [
    eq(eventLogs.batchId, batchId),
    eq(eventLogs.isDeleted, false),
  ];

  if (filters.eventStatus) {
    conditions.push(eq(eventLogs.eventStatus, filters.eventStatus));
  }

  const where = and(...conditions);
  const offset = (filters.page - 1) * filters.pageSize;

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

  // Get paginated events with total count via window function
  const rows = await db
    .select({
      ...getColumns(eventLogs),
      _totalCount: sql<number>`cast(count(*) over() as int)`,
    })
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.eventTimestamp))
    .offset(offset)
    .fetch(filters.pageSize);

  const totalCount = await getTotalCountFromPaginatedRows(db, where, rows, offset);
  const hasMore = offset + filters.pageSize < totalCount;
  const events = rows.map(({ _totalCount, ...event }) => event);

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
  const db = await getDb();
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
  const db = await getDb();
  await db.delete(eventLogs);
}
