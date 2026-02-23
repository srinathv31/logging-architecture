import { z } from 'zod';
import { dateField } from './common';

export const createProcessDefinitionSchema = z.object({
  processName: z.string().min(1).max(510),
  displayName: z.string().min(1).max(510),
  description: z.string().min(1),
  owningTeam: z.string().min(1).max(200),
  expectedSteps: z.number().int().positive().optional(),
  slaMs: z.number().int().positive().optional(),
});

export const listProcessesQuerySchema = z.object({
  isActive: z
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
