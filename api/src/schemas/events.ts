import { z } from "zod";
import { EVENT_TYPES, EVENT_STATUSES, HTTP_METHODS } from "../types/enums";
import {
  paginationQuerySchema,
  dateRangeQuerySchema,
  dateField,
} from "./common";

const MAX_SEARCH_WINDOW_DAYS = 30;
const MAX_SEARCH_WINDOW_MS = MAX_SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export const eventLogEntrySchema = z.object({
  correlationId: z.string().min(1).max(200),
  accountId: z.string().max(64).nullish(),
  traceId: z.string().min(1).max(200),
  spanId: z.string().max(64).optional(),
  parentSpanId: z.string().max(64).optional(),
  spanLinks: z.array(z.string().min(1).max(64)).optional(),
  batchId: z.string().max(200).optional(),
  applicationId: z.string().min(1).max(200),
  targetSystem: z.string().min(1).max(200),
  originatingSystem: z.string().min(1).max(200),
  processName: z.string().min(1).max(510),
  stepSequence: z.number().int().min(0).optional(),
  stepName: z.string().max(510).optional(),
  eventType: z.enum(EVENT_TYPES),
  eventStatus: z.enum(EVENT_STATUSES),
  identifiers: z.record(z.unknown()),
  summary: z.string().min(1),
  result: z.string().min(1).max(2048),
  metadata: z.record(z.unknown()).optional(),
  eventTimestamp: z.string().datetime({ offset: true }),
  executionTimeMs: z.number().int().min(0).optional(),
  endpoint: z.string().max(510).optional(),
  httpMethod: z.enum(HTTP_METHODS).optional(),
  httpStatusCode: z.number().int().min(100).max(599).optional(),
  errorCode: z.string().max(100).optional(),
  errorMessage: z.string().max(2048).optional(),
  requestPayload: z.string().optional(),
  responsePayload: z.string().optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export const createEventRequestSchema = z.object({
  events: z.union([eventLogEntrySchema, z.array(eventLogEntrySchema).min(1)]),
});

export const batchCreateEventRequestSchema = z.object({
  events: z.array(eventLogEntrySchema).min(1),
});

export const getEventsByAccountQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    processName: z.string().optional(),
    eventStatus: z.enum(EVENT_STATUSES).optional(),
    includeLinked: z
      .union([z.boolean(), z.string().transform((v) => v === "true")])
      .default(false),
  });

const searchPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

function validateDateWindow(
  value: { startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
) {
  const hasStartDate = typeof value.startDate === "string";
  const hasEndDate = typeof value.endDate === "string";

  if (hasStartDate !== hasEndDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: "startDate and endDate must both be provided",
    });
    return;
  }

  if (!hasStartDate || !hasEndDate) {
    return;
  }

  const startTime = Date.parse(value.startDate!);
  const endTime = Date.parse(value.endDate!);
  if (endTime < startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "endDate must be greater than or equal to startDate",
    });
    return;
  }

  if (endTime - startTime > MAX_SEARCH_WINDOW_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: `date window cannot exceed ${MAX_SEARCH_WINDOW_DAYS} days`,
    });
  }
}

export const textSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    accountId: z.string().max(64).optional(),
    processName: z.string().max(510).optional(),
  })
  .merge(dateRangeQuerySchema)
  .merge(searchPaginationSchema)
  .superRefine((value, ctx) => {
    if (!value.accountId && !value.processName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountId"],
        message: "accountId or processName is required",
      });
    }

    validateDateWindow(value, ctx);
  });

export const lookupEventsRequestSchema = z
  .object({
    accountId: z.string().max(64).optional(),
    processName: z.string().max(510).optional(),
    eventStatus: z.enum(EVENT_STATUSES).optional(),
  })
  .merge(dateRangeQuerySchema)
  .merge(paginationQuerySchema)
  .superRefine((value, ctx) => {
    if (!value.accountId && !value.processName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountId"],
        message: "accountId or processName is required",
      });
    }

    validateDateWindow(value, ctx);
  });

// ---- Response Schemas ----

export const eventLogResponseSchema = z.object({
  eventLogId: z.number(),
  executionId: z.string(),
  correlationId: z.string(),
  accountId: z.string().nullable(),
  traceId: z.string(),
  spanId: z.string().nullable(),
  parentSpanId: z.string().nullable(),
  spanLinks: z.unknown().nullable(),
  batchId: z.string().nullable(),
  applicationId: z.string(),
  targetSystem: z.string(),
  originatingSystem: z.string(),
  processName: z.string(),
  stepSequence: z.number().nullable(),
  stepName: z.string().nullable(),
  eventType: z.string(),
  eventStatus: z.string(),
  identifiers: z.unknown(),
  summary: z.string(),
  result: z.string(),
  metadata: z.unknown(),
  eventTimestamp: dateField,
  createdAt: dateField,
  executionTimeMs: z.number().nullable(),
  endpoint: z.string().nullable(),
  httpStatusCode: z.number().nullable(),
  httpMethod: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  requestPayload: z.string().nullable(),
  responsePayload: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  isDeleted: z.boolean(),
});

export const createEventResponseSchema = z.object({
  success: z.boolean(),
  executionIds: z.array(z.string()),
  correlationId: z.string(),
});

export const createEventArrayResponseSchema = z.object({
  success: z.boolean(),
  totalReceived: z.number().int(),
  totalInserted: z.number().int(),
  executionIds: z.array(z.string()),
  correlationIds: z.array(z.string()),
  errors: z
    .array(z.object({ index: z.number().int(), error: z.string() }))
    .optional(),
});

export const createEventUnionResponseSchema = z.union([
  createEventResponseSchema,
  createEventArrayResponseSchema,
]);

export const batchCreateEventResponseSchema = z.object({
  success: z.boolean(),
  totalReceived: z.number().int(),
  totalInserted: z.number().int(),
  executionIds: z.array(z.string()),
  errors: z
    .array(
      z.object({
        index: z.number().int(),
        error: z.string(),
      }),
    )
    .optional(),
});

export const getEventsByAccountResponseSchema = z.object({
  accountId: z.string(),
  events: z.array(eventLogResponseSchema),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});

export const getEventsByTraceResponseSchema = z.object({
  traceId: z.string(),
  events: z.array(eventLogResponseSchema),
  systemsInvolved: z.array(z.string()),
  totalDurationMs: z.number().nullable(),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
  statusCounts: z.object({
    success: z.number().int(),
    failure: z.number().int(),
    inProgress: z.number().int(),
    skipped: z.number().int(),
  }),
  processName: z.string().nullable(),
  accountId: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
});

export const getEventsByCorrelationResponseSchema = z.object({
  correlationId: z.string(),
  accountId: z.string().nullable(),
  events: z.array(eventLogResponseSchema),
  isLinked: z.boolean(),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});

export const accountSummaryResponseSchema = z.object({
  summary: z.object({
    accountId: z.string(),
    firstEventAt: z.string(),
    lastEventAt: z.string(),
    totalEvents: z.number().int(),
    totalProcesses: z.number().int(),
    errorCount: z.number().int(),
    lastProcess: z.string().nullable(),
    systemsTouched: z.array(z.string()).nullable(),
    correlationIds: z.array(z.string()).nullable(),
    updatedAt: z.string(),
  }),
  recentEvents: z.array(eventLogResponseSchema),
  recentErrors: z.array(eventLogResponseSchema),
});

export const textSearchResponseSchema = z.object({
  query: z.string(),
  events: z.array(eventLogResponseSchema),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const lookupEventsResponseSchema = z.object({
  events: z.array(eventLogResponseSchema),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});

// ---- Batch Operations Schemas ----

export const batchUploadRequestSchema = z.object({
  batchId: z.string().min(1).max(200),
  events: z.array(eventLogEntrySchema).min(1),
});

export const batchUploadResponseSchema = z.object({
  success: z.boolean(),
  batchId: z.string(),
  totalReceived: z.number().int(),
  totalInserted: z.number().int(),
  correlationIds: z.array(z.string()),
  errors: z
    .array(
      z.object({
        index: z.number().int(),
        error: z.string(),
      }),
    )
    .optional(),
});

export const getEventsByBatchQuerySchema = paginationQuerySchema.extend({
  eventStatus: z.enum(EVENT_STATUSES).optional(),
});

export const getEventsByBatchResponseSchema = z.object({
  batchId: z.string(),
  events: z.array(eventLogResponseSchema),
  totalCount: z.number().int(),
  uniqueCorrelationIds: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});

export const batchSummaryResponseSchema = z.object({
  batchId: z.string(),
  totalProcesses: z.number().int(),
  completed: z.number().int(),
  inProgress: z.number().int(),
  failed: z.number().int(),
  correlationIds: z.array(z.string()),
  startedAt: z.string().nullable(),
  lastEventAt: z.string().nullable(),
});
