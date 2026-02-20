import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const eventLogPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(500).default(200),
});

export const dateRangeQuerySchema = z.object({
  start_date: z.string().datetime({ offset: true }).optional(),
  end_date: z.string().datetime({ offset: true }).optional(),
});

/** Accepts Date objects (from Drizzle) or strings, outputs ISO string for JSON responses */
export const dateField = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString() : val),
  z.string(),
);
