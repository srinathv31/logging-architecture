import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import * as eventLogService from '../../services/event-log.service';

export async function byTraceRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/trace/:traceId',
    {
      schema: {
        params: z.object({ traceId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const { traceId } = request.params;
      const { events, systemsInvolved, totalDurationMs } =
        await eventLogService.getByTrace(traceId);

      return reply.send({
        trace_id: traceId,
        events,
        systems_involved: systemsInvolved,
        total_duration_ms: totalDurationMs,
      });
    },
  );
}
