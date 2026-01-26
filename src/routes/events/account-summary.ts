import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import * as accountSummaryService from '../../services/account-summary.service';

export async function accountSummaryRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/account/:accountId/summary',
    {
      schema: {
        params: z.object({ accountId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const { accountId } = request.params;
      const { summary, recentEvents, recentErrors } =
        await accountSummaryService.getAccountSummary(accountId);

      return reply.send({
        summary: {
          account_id: summary.accountId,
          first_event_at: summary.firstEventAt.toISOString(),
          last_event_at: summary.lastEventAt.toISOString(),
          total_events: summary.totalEvents,
          total_processes: summary.totalProcesses,
          error_count: summary.errorCount,
          last_process: summary.lastProcess,
          systems_touched: summary.systemsTouched,
          correlation_ids: summary.correlationIds,
          updated_at: summary.updatedAt.toISOString(),
        },
        recent_events: recentEvents,
        recent_errors: recentErrors,
      });
    },
  );
}
