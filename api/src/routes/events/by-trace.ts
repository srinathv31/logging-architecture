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
        description: 'Get all events associated with a distributed trace',
        params: z.object({ traceId: z.string().min(1) }),
        querystring: eventLogPaginationQuerySchema,
        response: { 200: getEventsByTraceResponseSchema },
      },
    },
    async (request, reply) => {
      const { traceId } = request.params;
      const { page, page_size } = request.query;
      const {
        events, systemsInvolved, totalDurationMs, totalCount, hasMore,
        statusCounts, processName, accountId, startTime, endTime,
      } = await eventLogService.getByTrace(traceId, { page, pageSize: page_size });

      return reply.send({
        trace_id: traceId,
        events,
        systems_involved: systemsInvolved,
        total_duration_ms: totalDurationMs,
        total_count: totalCount,
        page,
        page_size,
        has_more: hasMore,
        status_counts: {
          success: statusCounts.success,
          failure: statusCounts.failure,
          in_progress: statusCounts.inProgress,
          skipped: statusCounts.skipped,
        },
        process_name: processName,
        account_id: accountId,
        start_time: startTime,
        end_time: endTime,
      });
    },
  );
}
