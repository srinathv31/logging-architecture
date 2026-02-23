import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { textSearchRequestSchema, textSearchResponseSchema } from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function searchTextRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/search/text',
    {
      schema: {
        tags: ['Events'],
        description: 'Constrained text search with required account/process filters and bounded date windows',
        body: textSearchRequestSchema,
        response: { 200: textSearchResponseSchema },
      },
    },
    async (request, reply) => {
      const { query, accountId, processName, startDate, endDate, page, pageSize } =
        request.body;

      const { events, totalCount } = await eventLogService.searchText({
        query,
        accountId,
        processName,
        startDate,
        endDate,
        page,
        pageSize,
      });

      return reply.send({
        query,
        events,
        totalCount,
        page,
        pageSize,
      });
    },
  );
}
