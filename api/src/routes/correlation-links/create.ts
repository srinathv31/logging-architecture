import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createCorrelationLinkSchema, createCorrelationLinkResponseSchema } from '../../schemas/correlation-links';
import * as correlationLinkService from '../../services/correlation-link.service';

export async function createCorrelationLinkRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/',
    {
      schema: {
        tags: ['Correlation Links'],
        description: 'Create or update a correlation-to-account mapping',
        body: createCorrelationLinkSchema,
        response: { 201: createCorrelationLinkResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await correlationLinkService.createCorrelationLink(request.body);

      return reply.status(201).send({
        success: true,
        correlationId: result.correlationId,
        accountId: result.accountId,
        linkedAt: result.linkedAt.toISOString(),
      });
    },
  );
}
