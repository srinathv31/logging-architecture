import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as eventLogService from "../../services/event-log.service";

export async function clearEventsRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.delete(
    "/",
    {
      schema: {
        tags: ["Events"],
        description: "Clear all event log entries",
      },
    },
    async (request, reply) => {
      await eventLogService.deleteAll();
      return reply.status(204).send();
    },
  );
}
