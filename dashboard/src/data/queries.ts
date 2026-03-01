import "server-only";

import { apiGet } from "@/lib/api-client";

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

interface ApiTracesResponse {
  traces: Array<{
    traceId: string;
    eventCount: number;
    hasErrors: boolean;
    latestStatus: string;
    durationMs: number | null;
    processName: string | null;
    accountId: string | null;
    startTime: string;
    endTime: string;
  }>;
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function getTraces(filters: TraceListFilters): Promise<TraceListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const params: Record<string, string> = {
    page: String(page),
    pageSize: String(pageSize),
  };
  if (filters.processName) params.processName = filters.processName;
  if (filters.accountId) params.accountId = filters.accountId;
  if (filters.eventStatus) params.eventStatus = filters.eventStatus;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;

  const data = await apiGet<ApiTracesResponse>("/v1/traces", params);

  return {
    traces: data.traces.map((t) => ({
      traceId: t.traceId,
      processName: t.processName ?? "Unknown",
      accountId: t.accountId,
      eventCount: t.eventCount,
      hasErrors: t.hasErrors,
      latestStatus: t.latestStatus,
      firstEventAt: t.startTime,
      lastEventAt: t.endTime,
      totalDurationMs: t.durationMs,
    })),
    totalCount: data.totalCount,
    page: data.page,
    pageSize: data.pageSize,
    totalPages: Math.ceil(data.totalCount / data.pageSize),
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
  processName: string;
  accountId: string | null;
  startTime: string;
  endTime: string;
}

export interface DashboardStats {
  totalTraces: number;
  totalAccounts: number;
  totalSystems: number;
  successRate: number;
  totalEvents: number;
  systemNames: string[];
}

interface ApiDashboardStatsResponse {
  totalTraces: number;
  totalAccounts: number;
  totalEvents: number;
  successRate: number;
  systemNames: string[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const data = await apiGet<ApiDashboardStatsResponse>("/v1/dashboard/stats");

  return {
    totalTraces: data.totalTraces,
    totalAccounts: data.totalAccounts,
    totalSystems: data.systemNames.length,
    successRate: data.successRate,
    totalEvents: data.totalEvents,
    systemNames: data.systemNames,
  };
}

interface ApiTraceDetailResponse {
  traceId: string;
  events: Array<{
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
  }>;
  systemsInvolved: string[];
  totalDurationMs: number | null;
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  statusCounts: {
    success: number;
    failure: number;
    inProgress: number;
    skipped: number;
    warning: number;
  };
  processName: string | null;
  accountId: string | null;
  startTime: string | null;
  endTime: string | null;
}

export async function getTraceDetail(traceId: string): Promise<TraceDetail | null> {
  let data: ApiTraceDetailResponse;
  try {
    data = await apiGet<ApiTraceDetailResponse>(`/v1/events/trace/${traceId}`, {
      pageSize: "500",
    });
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }

  if (data.events.length === 0) return null;

  const statusCounts: Record<string, number> = {};
  if (data.statusCounts.success) statusCounts["SUCCESS"] = data.statusCounts.success;
  if (data.statusCounts.failure) statusCounts["FAILURE"] = data.statusCounts.failure;
  if (data.statusCounts.inProgress) statusCounts["IN_PROGRESS"] = data.statusCounts.inProgress;
  if (data.statusCounts.skipped) statusCounts["SKIPPED"] = data.statusCounts.skipped;
  if (data.statusCounts.warning) statusCounts["WARNING"] = data.statusCounts.warning;

  return {
    events: data.events.map((e) => ({
      eventLogId: e.eventLogId,
      executionId: e.executionId,
      correlationId: e.correlationId,
      accountId: e.accountId,
      traceId: e.traceId,
      spanId: e.spanId,
      parentSpanId: e.parentSpanId,
      batchId: e.batchId,
      applicationId: e.applicationId,
      targetSystem: e.targetSystem,
      originatingSystem: e.originatingSystem,
      processName: e.processName,
      stepSequence: e.stepSequence,
      stepName: e.stepName,
      eventType: e.eventType,
      eventStatus: e.eventStatus,
      identifiers: e.identifiers,
      summary: e.summary,
      result: e.result,
      metadata: e.metadata,
      eventTimestamp: e.eventTimestamp,
      createdAt: e.createdAt,
      executionTimeMs: e.executionTimeMs,
      endpoint: e.endpoint,
      httpStatusCode: e.httpStatusCode,
      httpMethod: e.httpMethod,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      requestPayload: e.requestPayload,
      responsePayload: e.responsePayload,
    })),
    systemsInvolved: data.systemsInvolved,
    totalDurationMs: data.totalDurationMs,
    statusCounts,
    processName: data.processName ?? "Unknown",
    accountId: data.accountId,
    startTime: data.startTime ?? new Date().toISOString(),
    endTime: data.endTime ?? new Date().toISOString(),
  };
}
