import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getEventsByCorrelationResponseSchema } from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function byCorrelationRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/correlation/:correlationId',
    {
      schema: {
        tags: ['Events'],
        description: 'Get all events associated with a correlation ID',
        params: z.object({ correlationId: z.string().min(1) }),
        response: { 200: getEventsByCorrelationResponseSchema },
      },
    },
    async (request, reply) => {
      const { correlationId } = request.params;
      const { events, accountId, isLinked } =
        await eventLogService.getByCorrelation(correlationId);

      return reply.send({
        correlation_id: correlationId,
        account_id: accountId,
        events,
        is_linked: isLinked,
      });
    },
  );
}
