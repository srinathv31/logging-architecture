import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getCorrelationLinkResponseSchema } from '../../schemas/correlation-links';
import * as correlationLinkService from '../../services/correlation-link.service';

export async function getCorrelationLinkRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/:correlationId',
    {
      schema: {
        tags: ['Correlation Links'],
        description: 'Retrieve a correlation link by its correlation ID',
        params: z.object({ correlationId: z.string().min(1) }),
        response: { 200: getCorrelationLinkResponseSchema },
      },
    },
    async (request, reply) => {
      const { correlationId } = request.params;
      const link = await correlationLinkService.getCorrelationLink(correlationId);

      return reply.send({
        correlationId: link.correlationId,
        accountId: link.accountId,
        applicationId: link.applicationId,
        customerId: link.customerId,
        cardNumberLast4: link.cardNumberLast4,
        linkedAt: link.linkedAt.toISOString(),
      });
    },
  );
}
