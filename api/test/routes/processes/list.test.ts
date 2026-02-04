import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createProcessDbRecord } from '../../fixtures/processes';
import { listProcessesQuerySchema, listProcessesResponseSchema } from '../../../src/schemas/processes';

// Mock function for listProcesses
let mockListProcesses: (isActive?: boolean) => Promise<ReturnType<typeof createProcessDbRecord>[]>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.get(
      '/',
      {
        schema: {
          querystring: listProcessesQuerySchema,
          response: { 200: listProcessesResponseSchema },
        },
      },
      async (request, reply) => {
        const { is_active } = request.query;
        const processes = await mockListProcesses(is_active ?? undefined);
        return reply.send({ processes });
      }
    );
  }, { prefix: '/v1/processes' });

  return app;
}

describe('GET /v1/processes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockListProcesses = async () => [];
  });

  describe('successful retrieval', () => {
    it('should return all processes', async () => {
      mockListProcesses = async () => [
        createProcessDbRecord({ processId: 1, processName: 'process-a' }),
        createProcessDbRecord({ processId: 2, processName: 'process-b' }),
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/v1/processes',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.processes).toHaveLength(2);
      expect(body.processes[0].processName).toBe('process-a');
      expect(body.processes[1].processName).toBe('process-b');
    });

    it('should return empty array when no processes exist', async () => {
      mockListProcesses = async () => [];

      const response = await app.inject({
        method: 'GET',
        url: '/v1/processes',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.processes).toHaveLength(0);
    });

    it('should filter by is_active=true', async () => {
      let capturedIsActive: boolean | undefined;
      mockListProcesses = async (isActive) => {
        capturedIsActive = isActive;
        return [createProcessDbRecord({ isActive: true })];
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/processes?is_active=true',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedIsActive).toBe(true);
    });

    it('should filter by is_active=false', async () => {
      let capturedIsActive: boolean | undefined;
      mockListProcesses = async (isActive) => {
        capturedIsActive = isActive;
        return [createProcessDbRecord({ isActive: false })];
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/processes?is_active=false',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedIsActive).toBe(false);
    });

    it('should return all fields for each process', async () => {
      mockListProcesses = async () => [
        createProcessDbRecord({
          processId: 1,
          processName: 'payment-process',
          displayName: 'Payment Process',
          description: 'Handles payment processing',
          owningTeam: 'payments-team',
          expectedSteps: 5,
          slaMs: 30000,
          isActive: true,
        }),
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/v1/processes',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const process = body.processes[0];
      expect(process.processId).toBe(1);
      expect(process.processName).toBe('payment-process');
      expect(process.displayName).toBe('Payment Process');
      expect(process.description).toBe('Handles payment processing');
      expect(process.owningTeam).toBe('payments-team');
      expect(process.expectedSteps).toBe(5);
      expect(process.slaMs).toBe(30000);
      expect(process.isActive).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockListProcesses = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/processes',
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
