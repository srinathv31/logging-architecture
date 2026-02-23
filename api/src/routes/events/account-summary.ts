import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { accountSummaryResponseSchema } from '../../schemas/events';
import * as accountSummaryService from '../../services/account-summary.service';

export async function accountSummaryRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/account/:accountId/summary',
    {
      schema: {
        tags: ['Events'],
        description: 'Get aggregated account summary with recent events and errors',
        params: z.object({ accountId: z.string().min(1) }),
        response: { 200: accountSummaryResponseSchema },
      },
    },
    async (request, reply) => {
      const { accountId } = request.params;
      const { summary, recentEvents, recentErrors } =
        await accountSummaryService.getAccountSummary(accountId);

      return reply.send({
        summary: {
          accountId: summary.accountId,
          firstEventAt: summary.firstEventAt.toISOString(),
          lastEventAt: summary.lastEventAt.toISOString(),
          totalEvents: summary.totalEvents,
          totalProcesses: summary.totalProcesses,
          errorCount: summary.errorCount,
          lastProcess: summary.lastProcess,
          systemsTouched: summary.systemsTouched,
          correlationIds: summary.correlationIds,
          updatedAt: summary.updatedAt.toISOString(),
        },
        recentEvents,
        recentErrors,
      });
    },
  );
}
