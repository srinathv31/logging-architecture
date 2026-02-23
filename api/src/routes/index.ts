import type { FastifyInstance } from 'fastify';
import { eventRoutes } from './events/index';
import { correlationLinkRoutes } from './correlation-links/index';
import { processRoutes } from './processes/index';
import { traceRoutes } from './traces/index';
import { dashboardRoutes } from './dashboard/index';
import { healthRoutes } from './health';
import { debugRoutes } from './debug';

export async function registerRoutes(app: FastifyInstance) {
  app.register(healthRoutes);
  app.register(eventRoutes, { prefix: '/events' });
  app.register(debugRoutes, { prefix: '/debug' });
  app.register(correlationLinkRoutes, { prefix: '/correlation-links' });
  app.register(processRoutes, { prefix: '/processes' });
  app.register(traceRoutes, { prefix: '/traces' });
  app.register(dashboardRoutes, { prefix: '/dashboard' });
}
