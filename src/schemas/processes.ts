import { z } from 'zod';

export const createProcessDefinitionSchema = z.object({
  process_name: z.string().min(1).max(510),
  display_name: z.string().min(1).max(510),
  description: z.string().min(1),
  owning_team: z.string().min(1).max(200),
  expected_steps: z.number().int().positive().optional(),
  sla_ms: z.number().int().positive().optional(),
});

export const listProcessesQuerySchema = z.object({
  is_active: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .optional(),
});
