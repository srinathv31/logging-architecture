import { z } from "zod";
import { paginationQuerySchema, dateRangeQuerySchema } from "./common";
import { EVENT_STATUSES } from "../types/enums";

export const listTracesQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    processName: z.string().optional(),
    eventStatus: z.enum(EVENT_STATUSES).optional(),
    accountId: z.string().max(64).optional(),
  });

export const traceSummarySchema = z.object({
  traceId: z.string(),
  eventCount: z.number().int(),
  hasErrors: z.boolean(),
  latestStatus: z.string(),
  durationMs: z.number().nullable(),
  processName: z.string().nullable(),
  accountId: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
});

export const listTracesResponseSchema = z.object({
  traces: z.array(traceSummarySchema),
  totalCount: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasMore: z.boolean(),
});
