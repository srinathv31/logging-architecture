import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { listProcessesQuerySchema } from '../../schemas/processes';
import * as processDefinitionService from '../../services/process-definition.service';

export async function listProcessesRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/',
    { schema: { querystring: listProcessesQuerySchema } },
    async (request, reply) => {
      const { is_active } = request.query;
      const processes = await processDefinitionService.listProcesses(is_active ?? undefined);
      return reply.send({ processes });
    },
  );
}
