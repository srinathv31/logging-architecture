import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  lookupEventsRequestSchema,
  lookupEventsResponseSchema,
} from "../../schemas/events";
import * as eventLogService from "../../services/event-log.service";

export async function lookupRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/lookup",
    {
      schema: {
        tags: ["Lookup"],
        description:
          "Fast structured event lookup by account/process with optional date and status filters",
        body: lookupEventsRequestSchema,
        response: { 200: lookupEventsResponseSchema },
      },
    },
    async (request, reply) => {
      const {
        account_id,
        process_name,
        event_status,
        start_date,
        end_date,
        page,
        page_size,
      } = request.body;

      const { events, totalCount, hasMore } = await eventLogService.lookupEvents({
        accountId: account_id,
        processName: process_name,
        eventStatus: event_status,
        startDate: start_date,
        endDate: end_date,
        page,
        pageSize: page_size,
      });

      return reply.send({
        events,
        total_count: totalCount,
        page,
        page_size,
        has_more: hasMore,
      });
    },
  );
}
