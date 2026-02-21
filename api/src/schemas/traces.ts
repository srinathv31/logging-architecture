import { z } from "zod";
import { paginationQuerySchema, dateRangeQuerySchema } from "./common";
import { EVENT_STATUSES } from "../types/enums";

export const listTracesQuerySchema = paginationQuerySchema
  .merge(dateRangeQuerySchema)
  .extend({
    process_name: z.string().optional(),
    event_status: z.enum(EVENT_STATUSES).optional(),
    account_id: z.string().max(64).optional(),
  });

export const traceSummarySchema = z.object({
  trace_id: z.string(),
  event_count: z.number().int(),
  has_errors: z.boolean(),
  latest_status: z.string(),
  duration_ms: z.number().nullable(),
  process_name: z.string().nullable(),
  account_id: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
});

export const listTracesResponseSchema = z.object({
  traces: z.array(traceSummarySchema),
  total_count: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  has_more: z.boolean(),
});
