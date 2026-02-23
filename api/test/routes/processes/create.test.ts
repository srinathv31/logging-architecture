import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createProcessFixture, createProcessDbRecord } from '../../fixtures/processes';
import { createProcessDefinitionSchema, createProcessResponseSchema } from '../../../src/schemas/processes';

// Mock function for createProcess
let mockCreateProcess: (data: {
  processName: string;
  displayName: string;
  description: string;
  owningTeam: string;
  expectedSteps?: number;
  slaMs?: number;
}) => Promise<ReturnType<typeof createProcessDbRecord>>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.post(
      '/',
      {
        schema: {
          body: createProcessDefinitionSchema,
          response: { 201: createProcessResponseSchema },
        },
      },
      async (request, reply) => {
        const { processName, displayName, description, owningTeam, expectedSteps, slaMs } =
          request.body;

        const result = await mockCreateProcess({
          processName,
          displayName,
          description,
          owningTeam,
          expectedSteps,
          slaMs,
        });

        return reply.status(201).send(result);
      }
    );
  }, { prefix: '/v1/processes' });

  return app;
}

describe('POST /v1/processes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockCreateProcess = async () => createProcessDbRecord();
  });

  describe('successful creation', () => {
    it('should create a process with required fields', async () => {
      const fixture = createProcessFixture();
      mockCreateProcess = async (data) => createProcessDbRecord({
        processName: data.processName,
        displayName: data.displayName,
        description: data.description,
        owningTeam: data.owningTeam,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          processName: fixture.processName,
          displayName: fixture.displayName,
          description: fixture.description,
          owningTeam: fixture.owningTeam,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.processName).toBe(fixture.processName);
      expect(body.displayName).toBe(fixture.displayName);
      expect(body.description).toBe(fixture.description);
      expect(body.owningTeam).toBe(fixture.owningTeam);
    });

    it('should create a process with all optional fields', async () => {
      const fixture = createProcessFixture({
        expectedSteps: 10,
        slaMs: 60000,
      });

      mockCreateProcess = async (data) => createProcessDbRecord({
        processName: data.processName,
        displayName: data.displayName,
        description: data.description,
        owningTeam: data.owningTeam,
        expectedSteps: data.expectedSteps,
        slaMs: data.slaMs,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: fixture,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.expectedSteps).toBe(10);
      expect(body.slaMs).toBe(60000);
    });

    it('should return new process with generated ID', async () => {
      mockCreateProcess = async () => createProcessDbRecord({ processId: 42 });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: createProcessFixture(),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.processId).toBe(42);
    });

    it('should return isActive as true by default', async () => {
      mockCreateProcess = async () => createProcessDbRecord({ isActive: true });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: createProcessFixture(),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.isActive).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('should require processName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          displayName: 'Test Process',
          description: 'A test process',
          owningTeam: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require displayName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          processName: 'test-process',
          description: 'A test process',
          owningTeam: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require description', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          processName: 'test-process',
          displayName: 'Test Process',
          owningTeam: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require owningTeam', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          processName: 'test-process',
          displayName: 'Test Process',
          description: 'A test process',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty processName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          processName: '',
          displayName: 'Test Process',
          description: 'A test process',
          owningTeam: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject non-positive expectedSteps', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          processName: 'test-process',
          displayName: 'Test Process',
          description: 'A test process',
          owningTeam: 'test-team',
          expectedSteps: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockCreateProcess = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: createProcessFixture(),
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
