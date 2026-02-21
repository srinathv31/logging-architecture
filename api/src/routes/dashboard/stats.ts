import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { dashboardStatsQuerySchema, dashboardStatsResponseSchema } from "../../schemas/dashboard";
import * as eventLogService from "../../services/event-log.service";

export async function dashboardStatsRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/stats",
    {
      schema: {
        tags: ["Dashboard"],
        description: "Get aggregate dashboard statistics",
        querystring: dashboardStatsQuerySchema,
        response: { 200: dashboardStatsResponseSchema },
      },
    },
    async (request, reply) => {
      const { start_date, end_date } = request.query;

      const stats = await eventLogService.getDashboardStats({
        startDate: start_date,
        endDate: end_date,
      });

      return reply.send({
        total_traces: stats.totalTraces,
        total_accounts: stats.totalAccounts,
        total_events: stats.totalEvents,
        success_rate: stats.successRate,
        system_names: stats.systemNames,
      });
    },
  );
}
