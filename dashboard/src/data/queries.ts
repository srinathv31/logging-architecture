import "server-only";

import { db } from "@/db/client";
import { eventLogs } from "@/db/schema";
import { sql, eq, ilike, and, gte, lte, count } from "drizzle-orm";

export interface TraceListFilters {
  processName?: string;
  batchId?: string;
  accountId?: string;
  eventStatus?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TraceSummary {
  traceId: string;
  processName: string;
  accountId: string | null;
  batchId: string | null;
  eventCount: number;
  hasErrors: boolean;
  latestStatus: string;
  firstEventAt: string;
  lastEventAt: string;
  totalDurationMs: number | null;
}

export interface TraceListResult {
  traces: TraceSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getTraces(filters: TraceListFilters): Promise<TraceListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(eventLogs.isDeleted, false)];

  if (filters.processName) {
    conditions.push(ilike(eventLogs.processName, `%${filters.processName}%`));
  }
  if (filters.batchId) {
    conditions.push(eq(eventLogs.batchId, filters.batchId));
  }
  if (filters.accountId) {
    conditions.push(eq(eventLogs.accountId, filters.accountId));
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

  const whereClause = and(...conditions);

  const [traces, countResult] = await Promise.all([
    db
      .select({
        traceId: eventLogs.traceId,
        processName: sql<string>`min(${eventLogs.processName})`,
        accountId: sql<string | null>`min(${eventLogs.accountId})`,
        batchId: sql<string | null>`min(${eventLogs.batchId})`,
        eventCount: sql<number>`count(*)::int`,
        hasErrors: sql<boolean>`bool_or(${eventLogs.eventStatus} = 'FAILURE')`,
        latestStatus: sql<string>`(array_agg(${eventLogs.eventStatus} ORDER BY ${eventLogs.eventTimestamp} DESC))[1]`,
        firstEventAt: sql<string>`min(${eventLogs.eventTimestamp})::text`,
        lastEventAt: sql<string>`max(${eventLogs.eventTimestamp})::text`,
        totalDurationMs: sql<number | null>`extract(epoch from (max(${eventLogs.eventTimestamp}) - min(${eventLogs.eventTimestamp})))::int * 1000`,
      })
      .from(eventLogs)
      .where(whereClause)
      .groupBy(eventLogs.traceId)
      .orderBy(sql`max(${eventLogs.eventTimestamp}) DESC`)
      .limit(pageSize)
      .offset(offset),

    db
      .select({
        totalCount: sql<number>`count(distinct ${eventLogs.traceId})::int`,
      })
      .from(eventLogs)
      .where(whereClause),
  ]);

  const totalCount = countResult[0]?.totalCount ?? 0;

  return {
    traces,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

export interface TraceEvent {
  eventLogId: number;
  executionId: string;
  correlationId: string;
  accountId: string | null;
  traceId: string;
  spanId: string | null;
  parentSpanId: string | null;
  batchId: string | null;
  applicationId: string;
  targetSystem: string;
  originatingSystem: string;
  processName: string;
  stepSequence: number | null;
  stepName: string | null;
  eventType: string;
  eventStatus: string;
  identifiers: unknown;
  summary: string;
  result: string;
  metadata: unknown;
  eventTimestamp: string;
  createdAt: string;
  executionTimeMs: number | null;
  endpoint: string | null;
  httpStatusCode: number | null;
  httpMethod: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestPayload: string | null;
  responsePayload: string | null;
}

export interface TraceDetail {
  events: TraceEvent[];
  systemsInvolved: string[];
  totalDurationMs: number | null;
  statusCounts: Record<string, number>;
}

export async function getTraceDetail(traceId: string): Promise<TraceDetail | null> {
  const rows = await db
    .select()
    .from(eventLogs)
    .where(and(eq(eventLogs.traceId, traceId), eq(eventLogs.isDeleted, false)))
    .orderBy(eventLogs.stepSequence, eventLogs.eventTimestamp);

  if (rows.length === 0) return null;

  const systems = new Set<string>();
  const statusCounts: Record<string, number> = {};

  const events: TraceEvent[] = rows.map((row) => {
    systems.add(row.targetSystem);
    systems.add(row.originatingSystem);
    statusCounts[row.eventStatus] = (statusCounts[row.eventStatus] ?? 0) + 1;

    return {
      eventLogId: row.eventLogId,
      executionId: row.executionId,
      correlationId: row.correlationId,
      accountId: row.accountId,
      traceId: row.traceId,
      spanId: row.spanId,
      parentSpanId: row.parentSpanId,
      batchId: row.batchId,
      applicationId: row.applicationId,
      targetSystem: row.targetSystem,
      originatingSystem: row.originatingSystem,
      processName: row.processName,
      stepSequence: row.stepSequence,
      stepName: row.stepName,
      eventType: row.eventType,
      eventStatus: row.eventStatus,
      identifiers: row.identifiers,
      summary: row.summary,
      result: row.result,
      metadata: row.metadata,
      eventTimestamp: row.eventTimestamp.toISOString(),
      createdAt: row.createdAt.toISOString(),
      executionTimeMs: row.executionTimeMs,
      endpoint: row.endpoint,
      httpStatusCode: row.httpStatusCode,
      httpMethod: row.httpMethod,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      requestPayload: row.requestPayload,
      responsePayload: row.responsePayload,
    };
  });

  const timestamps = rows.map((r) => r.eventTimestamp.getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const totalDurationMs = maxTs - minTs;

  return {
    events,
    systemsInvolved: Array.from(systems),
    totalDurationMs: totalDurationMs > 0 ? totalDurationMs : null,
    statusCounts,
  };
}
