import type { FastifyInstance } from "fastify";
import { listTracesRoute } from "./list";

export async function traceRoutes(app: FastifyInstance) {
  app.register(listTracesRoute);
}
