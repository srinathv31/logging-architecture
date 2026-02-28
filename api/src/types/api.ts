import type { EventLog } from '../db/schema/index';
import type { EventStatus } from './enums';

// POST /api/v1/events
export interface CreateEventResponse {
  success: boolean;
  executionIds: string[];
  correlationId: string;
}

// POST /api/v1/events/batch
export interface BatchCreateEventRequest {
  events: EventLogEntry[];
  batchId?: string;
}

export interface BatchCreateEventResponse {
  success: boolean;
  totalReceived: number;
  totalInserted: number;
  executionIds: string[];
  correlationIds: string[];
  batchId?: string;
  errors?: Array<{ index: number; error: string }>;
}

// GET /api/v1/events/account/:accountId
export interface GetEventsByAccountRequest {
  accountId: string;
  startDate?: string;
  endDate?: string;
  processName?: string;
  eventStatus?: EventStatus;
  includeLinked?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GetEventsByAccountResponse {
  accountId: string;
  events: EventLog[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// GET /api/v1/events/correlation/:correlationId
export interface GetEventsByCorrelationResponse {
  correlationId: string;
  accountId?: string | null;
  events: EventLog[];
  isLinked: boolean;
}

// GET /api/v1/events/trace/:traceId
export interface GetEventsByTraceResponse {
  traceId: string;
  events: EventLog[];
  systemsInvolved: string[];
  totalDurationMs?: number | null;
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

// GET /api/v1/traces
export interface TraceSummary {
  traceId: string;
  eventCount: number;
  hasErrors: boolean;
  latestStatus: string;
  durationMs: number | null;
  processName: string | null;
  accountId: string | null;
  startTime: string;
  endTime: string;
}

export interface ListTracesResponse {
  traces: TraceSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// GET /api/v1/dashboard/stats
export interface DashboardStatsResponse {
  totalTraces: number;
  totalAccounts: number;
  totalEvents: number;
  successRate: number;
  systemNames: string[];
}

// POST /api/v1/events/search/text
export interface TextSearchRequest {
  query: string;
  accountId?: string;
  processName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TextSearchResponse {
  query: string;
  events: EventLog[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// POST /api/v1/events/lookup
export interface LookupEventsRequest {
  accountId?: string;
  processName?: string;
  eventStatus?: EventStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface LookupEventsResponse {
  events: EventLog[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// POST /api/v1/correlation-links
export interface CreateCorrelationLinkRequest {
  correlationId: string;
  accountId: string;
  applicationId?: string;
  customerId?: string;
  cardNumberLast4?: string;
}

export interface CreateCorrelationLinkResponse {
  success: boolean;
  correlationId: string;
  accountId: string;
  linkedAt: string;
}

// GET /api/v1/events/account/:accountId/summary
export interface GetAccountSummaryResponse {
  summary: {
    accountId: string;
    firstEventAt: string;
    lastEventAt: string;
    totalEvents: number;
    totalProcesses: number;
    errorCount: number;
    lastProcess?: string | null;
    systemsTouched?: string[] | null;
    correlationIds?: string[] | null;
    updatedAt: string;
  };
  recentEvents: EventLog[];
  recentErrors: EventLog[];
}

// Event log entry (for API input - doesn't include auto-generated fields)
export interface EventLogEntry {
  correlationId: string;
  accountId?: string | null;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  spanLinks?: string[];
  batchId?: string;
  applicationId: string;
  targetSystem: string;
  originatingSystem: string;
  processName: string;
  stepSequence?: number;
  stepName?: string;
  eventType: string;
  eventStatus: string;
  identifiers: Record<string, unknown>;
  summary: string;
  result: string;
  metadata?: Record<string, unknown>;
  eventTimestamp: string;
  executionTimeMs?: number;
  endpoint?: string;
  httpMethod?: string;
  httpStatusCode?: number;
  errorCode?: string;
  errorMessage?: string;
  requestPayload?: string;
  responsePayload?: string;
  idempotencyKey?: string;
}

// GET /api/v1/events/batch/:batchId
export interface GetEventsByBatchResponse {
  batchId: string;
  events: EventLog[];
  totalCount: number;
  uniqueCorrelationIds: number;
  successCount: number;
  failureCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// GET /api/v1/events/batch/:batchId/summary
export interface BatchSummaryResponse {
  batchId: string;
  totalProcesses: number;
  completed: number;
  inProgress: number;
  failed: number;
  correlationIds: string[];
  startedAt: string | null;
  lastEventAt: string | null;
}
