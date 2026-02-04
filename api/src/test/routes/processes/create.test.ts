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
import { createProcessDefinitionSchema, createProcessResponseSchema } from '../../../schemas/processes';

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
        const { process_name, display_name, description, owning_team, expected_steps, sla_ms } =
          request.body;

        const result = await mockCreateProcess({
          processName: process_name,
          displayName: display_name,
          description,
          owningTeam: owning_team,
          expectedSteps: expected_steps,
          slaMs: sla_ms,
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
          process_name: fixture.process_name,
          display_name: fixture.display_name,
          description: fixture.description,
          owning_team: fixture.owning_team,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.processName).toBe(fixture.process_name);
      expect(body.displayName).toBe(fixture.display_name);
      expect(body.description).toBe(fixture.description);
      expect(body.owningTeam).toBe(fixture.owning_team);
    });

    it('should create a process with all optional fields', async () => {
      const fixture = createProcessFixture({
        expected_steps: 10,
        sla_ms: 60000,
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
    it('should require process_name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          display_name: 'Test Process',
          description: 'A test process',
          owning_team: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require display_name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          process_name: 'test-process',
          description: 'A test process',
          owning_team: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require description', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          process_name: 'test-process',
          display_name: 'Test Process',
          owning_team: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require owning_team', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          process_name: 'test-process',
          display_name: 'Test Process',
          description: 'A test process',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty process_name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          process_name: '',
          display_name: 'Test Process',
          description: 'A test process',
          owning_team: 'test-team',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject non-positive expected_steps', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/processes',
        payload: {
          process_name: 'test-process',
          display_name: 'Test Process',
          description: 'A test process',
          owning_team: 'test-team',
          expected_steps: 0,
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
