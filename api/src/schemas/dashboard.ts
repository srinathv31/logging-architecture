import { z } from "zod";
import { dateRangeQuerySchema } from "./common";

export const dashboardStatsQuerySchema = dateRangeQuerySchema;

export const dashboardStatsResponseSchema = z.object({
  total_traces: z.number().int(),
  total_accounts: z.number().int(),
  total_events: z.number().int(),
  success_rate: z.number(),
  system_names: z.array(z.string()),
});
