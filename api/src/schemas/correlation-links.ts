import { z } from 'zod';

export const createCorrelationLinkSchema = z.object({
  correlationId: z.string().regex(/^[0-9a-f]{32}$/, 'Must be 32 lowercase hex characters (W3C Trace Context)'),
  accountId: z.string().min(1).max(64),
  applicationId: z.string().max(100).optional(),
  customerId: z.string().max(100).optional(),
  cardNumberLast4: z.string().length(4).optional(),
});

// ---- Response Schemas ----

export const createCorrelationLinkResponseSchema = z.object({
  success: z.boolean(),
  correlationId: z.string(),
  accountId: z.string(),
  linkedAt: z.string(),
});

export const getCorrelationLinkResponseSchema = z.object({
  correlationId: z.string(),
  accountId: z.string(),
  applicationId: z.string().nullable(),
  customerId: z.string().nullable(),
  cardNumberLast4: z.string().nullable(),
  linkedAt: z.string(),
});
