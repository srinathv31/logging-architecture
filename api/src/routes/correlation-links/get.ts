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
        correlation_id: link.correlationId,
        account_id: link.accountId,
        application_id: link.applicationId,
        customer_id: link.customerId,
        card_number_last4: link.cardNumberLast4,
        linked_at: link.linkedAt.toISOString(),
      });
    },
  );
}
