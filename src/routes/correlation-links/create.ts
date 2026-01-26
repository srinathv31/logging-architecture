import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createCorrelationLinkSchema } from '../../schemas/correlation-links';
import * as correlationLinkService from '../../services/correlation-link.service';

export async function createCorrelationLinkRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/',
    { schema: { body: createCorrelationLinkSchema } },
    async (request, reply) => {
      const result = await correlationLinkService.createCorrelationLink(request.body);

      return reply.status(201).send({
        success: true,
        correlation_id: result.correlationId,
        account_id: result.accountId,
        linked_at: result.linkedAt.toISOString(),
      });
    },
  );
}
