import type { FastifyInstance } from "fastify";
import { debugClearEventsRoute } from "./clear-events";

export async function debugRoutes(app: FastifyInstance) {
  app.register(debugClearEventsRoute);
}
