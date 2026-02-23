import { z } from "zod";
import { dateRangeQuerySchema } from "./common";

export const dashboardStatsQuerySchema = dateRangeQuerySchema;

export const dashboardStatsResponseSchema = z.object({
  totalTraces: z.number().int(),
  totalAccounts: z.number().int(),
  totalEvents: z.number().int(),
  successRate: z.number(),
  systemNames: z.array(z.string()),
});
