import { z } from 'zod';
import { dateField } from './common';

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

// ---- Response Schemas ----

export const processDefinitionResponseSchema = z.object({
  processId: z.number().int(),
  processName: z.string(),
  displayName: z.string(),
  description: z.string(),
  owningTeam: z.string(),
  expectedSteps: z.number().int().nullable(),
  slaMs: z.number().int().nullable(),
  isActive: z.boolean(),
  createdAt: dateField,
  updatedAt: dateField,
});

export const listProcessesResponseSchema = z.object({
  processes: z.array(processDefinitionResponseSchema),
});

export const createProcessResponseSchema = processDefinitionResponseSchema;
