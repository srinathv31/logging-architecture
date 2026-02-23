import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { listProcessesQuerySchema, listProcessesResponseSchema } from '../../schemas/processes';
import * as processDefinitionService from '../../services/process-definition.service';

export async function listProcessesRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/',
    {
      schema: {
        tags: ['Processes'],
        description: 'List all process definitions, optionally filtered by active status',
        querystring: listProcessesQuerySchema,
        response: { 200: listProcessesResponseSchema },
      },
    },
    async (request, reply) => {
      const { isActive } = request.query;
      const processes = await processDefinitionService.listProcesses(isActive ?? undefined);
      return reply.send({ processes });
    },
  );
}
