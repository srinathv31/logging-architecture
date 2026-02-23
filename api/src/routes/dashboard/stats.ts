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
        summary: "Get dashboard statistics",
        description:
          "Returns aggregate statistics for the dashboard overview: total traces, total unique accounts, total events, trace-level success rate (percentage of traces with zero failures), and a list of all distinct system names. Supports optional date range filtering.",
        querystring: dashboardStatsQuerySchema,
        response: { 200: dashboardStatsResponseSchema },
      },
    },
    async (request, reply) => {
      const { startDate, endDate } = request.query;

      const stats = await eventLogService.getDashboardStats({
        startDate,
        endDate,
      });

      return reply.send({
        totalTraces: stats.totalTraces,
        totalAccounts: stats.totalAccounts,
        totalEvents: stats.totalEvents,
        successRate: stats.successRate,
        systemNames: stats.systemNames,
      });
    },
  );
}
