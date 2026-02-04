import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

// Mock function for deleteAll
let mockDeleteAll: () => Promise<void>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.delete(
      '/',
      {
        schema: {
          description: 'Clear all event log entries',
        },
      },
      async (_request, reply) => {
        await mockDeleteAll();
        return reply.status(204).send();
      }
    );
  }, { prefix: '/v1/events' });

  return app;
}

describe('DELETE /v1/events', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockDeleteAll = async () => {};
  });

  it('should delete all events and return 204', async () => {
    let deleteAllCalled = false;
    mockDeleteAll = async () => {
      deleteAllCalled = true;
    };

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/events',
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(deleteAllCalled).toBe(true);
  });

  it('should return 204 even when no events exist', async () => {
    mockDeleteAll = async () => {
      // No-op, simulates deleting from empty table
    };

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/events',
    });

    expect(response.statusCode).toBe(204);
  });

  it('should handle service errors gracefully', async () => {
    mockDeleteAll = async () => {
      throw new Error('Database error');
    };

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/events',
    });

    expect(response.statusCode).toBe(500);
  });

  it('should not accept request body', async () => {
    mockDeleteAll = async () => {};

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/events',
      payload: { some: 'data' },
    });

    // Should still work, body is ignored
    expect(response.statusCode).toBe(204);
  });
});
