import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createProcessDefinitionSchema, createProcessResponseSchema } from '../../schemas/processes';
import * as processDefinitionService from '../../services/process-definition.service';

export async function createProcessRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/',
    {
      schema: {
        tags: ['Processes'],
        description: 'Register a new process definition',
        body: createProcessDefinitionSchema,
        response: { 201: createProcessResponseSchema },
      },
    },
    async (request, reply) => {
      const { processName, displayName, description, owningTeam, expectedSteps, slaMs } =
        request.body;

      const result = await processDefinitionService.createProcess({
        processName,
        displayName,
        description,
        owningTeam,
        expectedSteps,
        slaMs,
      });

      return reply.status(201).send(result);
    },
  );
}
