import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eventLogPaginationQuerySchema } from '../../schemas/common';
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
        querystring: eventLogPaginationQuerySchema,
        response: { 200: getEventsByCorrelationResponseSchema },
      },
    },
    async (request, reply) => {
      const { correlationId } = request.params;
      const { page, pageSize } = request.query;
      const { events, accountId, isLinked, totalCount, hasMore } =
        await eventLogService.getByCorrelation(correlationId, { page, pageSize });

      return reply.send({
        correlationId,
        accountId,
        events,
        isLinked,
        totalCount,
        page,
        pageSize,
        hasMore,
      });
    },
  );
}
