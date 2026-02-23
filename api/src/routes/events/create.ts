import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  eventLogEntrySchema,
  createEventResponseSchema,
} from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function createEventRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /events — single event insert (flat body)
  typedApp.post(
    '/',
    {
      schema: {
        tags: ['Events'],
        description: 'Create a single event log entry',
        body: eventLogEntrySchema,
        response: { 201: createEventResponseSchema },
      },
    },
    async (request, reply) => {
      const event = request.body;
      const result = await eventLogService.createEvent(event);
      return reply.status(201).send({
        success: true,
        executionIds: [result.executionId],
        correlationId: event.correlationId,
      });
    },
  );
}
