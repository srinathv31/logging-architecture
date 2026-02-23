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
        accountId,
        processName,
        eventStatus,
        startDate,
        endDate,
        page,
        pageSize,
      } = request.body;

      const { events, totalCount, hasMore } = await eventLogService.lookupEvents({
        accountId,
        processName,
        eventStatus,
        startDate,
        endDate,
        page,
        pageSize,
      });

      return reply.send({
        events,
        totalCount,
        page,
        pageSize,
        hasMore,
      });
    },
  );
}
