import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import * as eventLogService from "../../services/event-log.service";

const clearBodySchema = z.object({
  confirm: z.literal(true),
});

export async function debugClearEventsRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // TODO: Remove debug clear endpoint before production staging deployment.
  typedApp.post(
    "/events/clear",
    {
      schema: {
        tags: ["Debug"],
        description:
          "Temporary debug endpoint that hard-deletes data from all Event Log tables",
        body: clearBodySchema,
      },
    },
    async (_request, reply) => {
      await eventLogService.deleteAll();
      return reply.status(204).send();
    },
  );
}
