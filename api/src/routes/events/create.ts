import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createEventRequestSchema,
  batchCreateEventRequestSchema,
  createEventResponseSchema,
  batchCreateEventResponseSchema,
} from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function createEventRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /events — single or array insert
  typedApp.post(
    '/',
    {
      schema: {
        tags: ['Events'],
        description: 'Create one or more event log entries',
        body: createEventRequestSchema,
        response: { 201: createEventResponseSchema },
      },
    },
    async (request, reply) => {
      const { events } = request.body;

      if (Array.isArray(events)) {
        const results = await Promise.all(events.map((e) => eventLogService.createEvent(e)));
        const correlationId = events[0].correlation_id;
        return reply.status(201).send({
          success: true,
          execution_ids: results.map((r) => r.executionId),
          correlation_id: correlationId,
        });
      }

      const result = await eventLogService.createEvent(events);
      return reply.status(201).send({
        success: true,
        execution_ids: [result.executionId],
        correlation_id: events.correlation_id,
      });
    },
  );

  // POST /events/batch — batch insert with per-item errors
  typedApp.post(
    '/batch',
    {
      schema: {
        tags: ['Events'],
        description: 'Batch create event log entries with per-item error reporting',
        body: batchCreateEventRequestSchema,
        response: { 201: batchCreateEventResponseSchema },
      },
    },
    async (request, reply) => {
      const { events } = request.body;
      const { executionIds, errors } = await eventLogService.createEvents(events);

      return reply.status(201).send({
        success: errors.length === 0,
        total_received: events.length,
        total_inserted: executionIds.length,
        execution_ids: executionIds,
        errors: errors.length > 0 ? errors : undefined,
      });
    },
  );
}
