import type { FastifyInstance } from 'fastify';
import { listProcessesRoute } from './list';
import { createProcessRoute } from './create';

export async function processRoutes(app: FastifyInstance) {
  app.register(listProcessesRoute);
  app.register(createProcessRoute);
}
