import type { FastifyInstance } from 'fastify';
import { eventRoutes } from './events/index';
import { correlationLinkRoutes } from './correlation-links/index';
import { processRoutes } from './processes/index';

export async function registerRoutes(app: FastifyInstance) {
  app.register(eventRoutes, { prefix: '/events' });
  app.register(correlationLinkRoutes, { prefix: '/correlation-links' });
  app.register(processRoutes, { prefix: '/processes' });
}
