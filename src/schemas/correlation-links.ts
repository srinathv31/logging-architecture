import { z } from 'zod';

export const createCorrelationLinkSchema = z.object({
  correlation_id: z.string().min(1).max(200),
  account_id: z.string().min(1).max(64),
  application_id: z.string().max(100).optional(),
  customer_id: z.string().max(100).optional(),
  card_number_last4: z.string().length(4).optional(),
});

// ---- Response Schemas ----

export const createCorrelationLinkResponseSchema = z.object({
  success: z.boolean(),
  correlation_id: z.string(),
  account_id: z.string(),
  linked_at: z.string(),
});

export const getCorrelationLinkResponseSchema = z.object({
  correlation_id: z.string(),
  account_id: z.string(),
  application_id: z.string().nullable(),
  customer_id: z.string().nullable(),
  card_number_last4: z.string().nullable(),
  linked_at: z.string(),
});
