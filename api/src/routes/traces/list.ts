import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { listTracesQuerySchema } from "../../schemas/traces";
import { listTracesResponseSchema } from "../../schemas/traces";
import * as eventLogService from "../../services/event-log.service";

export async function listTracesRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/",
    {
      schema: {
        tags: ["Traces"],
        summary: "List traces",
        description:
          "Returns a paginated list of traces grouped by `trace_id`. Each trace summary includes event count, error presence, latest status, duration, process name, and account ID. Supports filtering by date range, process name, event status, and account ID. Ordered by most recent activity descending.",
        querystring: listTracesQuerySchema,
        response: { 200: listTracesResponseSchema },
      },
    },
    async (request, reply) => {
      const { page, pageSize, startDate, endDate, processName, eventStatus, accountId } =
        request.query;

      const { traces, totalCount, hasMore } = await eventLogService.listTraces({
        startDate,
        endDate,
        processName,
        eventStatus,
        accountId,
        page,
        pageSize,
      });

      return reply.send({
        traces,
        totalCount,
        page,
        pageSize,
        hasMore,
      });
    },
  );
}
