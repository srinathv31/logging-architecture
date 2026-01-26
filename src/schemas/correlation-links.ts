import { z } from 'zod';

export const createCorrelationLinkSchema = z.object({
  correlation_id: z.string().min(1).max(200),
  account_id: z.string().min(1).max(64),
  application_id: z.string().max(100).optional(),
  customer_id: z.string().max(100).optional(),
  card_number_last4: z.string().length(4).optional(),
});
