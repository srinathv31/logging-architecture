import type { FastifyInstance } from "fastify";
import { dashboardStatsRoute } from "./stats";

export async function dashboardRoutes(app: FastifyInstance) {
  app.register(dashboardStatsRoute);
}
