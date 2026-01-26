import type { FastifyInstance } from 'fastify';
import { createCorrelationLinkRoute } from './create';
import { getCorrelationLinkRoute } from './get';

export async function correlationLinkRoutes(app: FastifyInstance) {
  app.register(createCorrelationLinkRoute);
  app.register(getCorrelationLinkRoute);
}
