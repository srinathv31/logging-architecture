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
        description:
          "List traces grouped by trace_id with aggregate info",
        querystring: listTracesQuerySchema,
        response: { 200: listTracesResponseSchema },
      },
    },
    async (request, reply) => {
      const { page, page_size, start_date, end_date, process_name, event_status, account_id } =
        request.query;

      const { traces, totalCount, hasMore } = await eventLogService.listTraces({
        startDate: start_date,
        endDate: end_date,
        processName: process_name,
        eventStatus: event_status,
        accountId: account_id,
        page,
        pageSize: page_size,
      });

      return reply.send({
        traces,
        total_count: totalCount,
        page,
        page_size,
        has_more: hasMore,
      });
    },
  );
}
