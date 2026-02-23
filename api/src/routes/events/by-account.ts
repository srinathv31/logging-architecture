import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getEventsByAccountQuerySchema, getEventsByAccountResponseSchema } from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function byAccountRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/account/:accountId',
    {
      schema: {
        tags: ['Events'],
        description: 'Query event logs for a specific account with filtering and pagination',
        params: z.object({ accountId: z.string().min(1) }),
        querystring: getEventsByAccountQuerySchema,
        response: { 200: getEventsByAccountResponseSchema },
      },
    },
    async (request, reply) => {
      const { accountId } = request.params;
      const { page, pageSize, startDate, endDate, processName, eventStatus, includeLinked } =
        request.query;

      const { events, totalCount, hasMore } = await eventLogService.getByAccount(accountId, {
        startDate,
        endDate,
        processName,
        eventStatus,
        includeLinked,
        page,
        pageSize,
      });

      return reply.send({
        accountId,
        events,
        totalCount,
        page,
        pageSize,
        hasMore,
      });
    },
  );
}
