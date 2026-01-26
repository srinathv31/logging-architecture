import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getEventsByAccountQuerySchema } from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function byAccountRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/account/:accountId',
    {
      schema: {
        params: z.object({ accountId: z.string().min(1) }),
        querystring: getEventsByAccountQuerySchema,
      },
    },
    async (request, reply) => {
      const { accountId } = request.params;
      const { page, page_size, start_date, end_date, process_name, event_status, include_linked } =
        request.query;

      const { events, totalCount, hasMore } = await eventLogService.getByAccount(accountId, {
        startDate: start_date,
        endDate: end_date,
        processName: process_name,
        eventStatus: event_status,
        includeLinked: include_linked,
        page,
        pageSize: page_size,
      });

      return reply.send({
        account_id: accountId,
        events,
        total_count: totalCount,
        page,
        page_size,
        has_more: hasMore,
      });
    },
  );
}
