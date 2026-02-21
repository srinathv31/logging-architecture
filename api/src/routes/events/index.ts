import type { FastifyInstance } from "fastify";
import { createEventRoutes } from "./create";
import { byAccountRoutes } from "./by-account";
import { accountSummaryRoutes } from "./account-summary";
import { byCorrelationRoutes } from "./by-correlation";
import { byTraceRoutes } from "./by-trace";
import { searchTextRoutes } from "./search-text";
import { lookupRoutes } from "./lookup";
import { batchRoutes } from "./batch";
import { clearEventsRoute } from "./clear";

export async function eventRoutes(app: FastifyInstance) {
  app.register(createEventRoutes);
  app.register(byAccountRoutes);
  app.register(accountSummaryRoutes);
  app.register(byCorrelationRoutes);
  app.register(byTraceRoutes);
  app.register(searchTextRoutes);
  app.register(lookupRoutes);
  app.register(batchRoutes);
  app.register(clearEventsRoute);
}
