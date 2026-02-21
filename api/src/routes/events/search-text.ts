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
      const { query, account_id, process_name, start_date, end_date, page, page_size } =
        request.body;

      const { events, totalCount } = await eventLogService.searchText({
        query,
        accountId: account_id,
        processName: process_name,
        startDate: start_date,
        endDate: end_date,
        page,
        pageSize: page_size,
      });

      return reply.send({
        query,
        events,
        total_count: totalCount,
        page,
        page_size,
      });
    },
  );
}
