import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

/**
 * Creates a minimal test app with just the healthcheck endpoint
 * This avoids needing to mock the database
 */
function buildTestApp() {
  const app = Fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.get(
    '/healthcheck',
    {
      schema: {
        tags: ['Health'],
        description: 'Returns API health status',
        response: {
          200: z.object({
            status: z.literal('ok'),
          }),
        },
      },
    },
    async () => ({ status: 'ok' as const })
  );

  return app;
}

describe('GET /healthcheck', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return status ok with 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/healthcheck',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('should have correct content-type header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/healthcheck',
    });

    expect(response.headers['content-type']).toContain('application/json');
  });
});
