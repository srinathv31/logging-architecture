import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eventLogPaginationQuerySchema } from '../../schemas/common';
import { getEventsByTraceResponseSchema } from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function byTraceRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/trace/:traceId',
    {
      schema: {
        tags: ['Events'],
        summary: 'Get events by trace ID',
        description: 'Returns paginated events for a distributed trace along with aggregate metadata: systems involved, total duration, per-status event counts, process name, account ID, and start/end timestamps. Designed for the dashboard trace-detail view.',
        params: z.object({ traceId: z.string().min(1) }),
        querystring: eventLogPaginationQuerySchema,
        response: { 200: getEventsByTraceResponseSchema },
      },
    },
    async (request, reply) => {
      const { traceId } = request.params;
      const { page, pageSize } = request.query;
      const {
        events, systemsInvolved, totalDurationMs, totalCount, hasMore,
        statusCounts, processName, accountId, startTime, endTime,
      } = await eventLogService.getByTrace(traceId, { page, pageSize });

      return reply.send({
        traceId,
        events,
        systemsInvolved,
        totalDurationMs,
        totalCount,
        page,
        pageSize,
        hasMore,
        statusCounts,
        processName,
        accountId,
        startTime,
        endTime,
      });
    },
  );
}
