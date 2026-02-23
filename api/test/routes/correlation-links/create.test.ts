import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createCorrelationLinkFixture, createCorrelationLinkDbRecord } from '../../fixtures/correlation-links';
import { createCorrelationLinkSchema, createCorrelationLinkResponseSchema } from '../../../src/schemas/correlation-links';

// Mock function for createCorrelationLink
let mockCreateCorrelationLink: (data: unknown) => Promise<ReturnType<typeof createCorrelationLinkDbRecord>>;

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
          body: createCorrelationLinkSchema,
          response: { 201: createCorrelationLinkResponseSchema },
        },
      },
      async (request, reply) => {
        const result = await mockCreateCorrelationLink(request.body);

        return reply.status(201).send({
          success: true,
          correlationId: result.correlationId,
          accountId: result.accountId,
          linkedAt: result.linkedAt.toISOString(),
        });
      }
    );
  }, { prefix: '/v1/correlation-links' });

  return app;
}

describe('POST /v1/correlation-links', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockCreateCorrelationLink = async () => createCorrelationLinkDbRecord();
  });

  describe('successful creation', () => {
    it('should create a correlation link successfully', async () => {
      const fixture = createCorrelationLinkFixture();
      mockCreateCorrelationLink = async () => createCorrelationLinkDbRecord({
        correlationId: fixture.correlationId,
        accountId: fixture.accountId,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: fixture,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.correlationId).toBe(fixture.correlationId);
      expect(body.accountId).toBe(fixture.accountId);
      expect(body.linkedAt).toBeDefined();
    });

    it('should create with required fields only', async () => {
      const fixture = {
        correlationId: 'corr-123',
        accountId: 'acc-456',
      };

      mockCreateCorrelationLink = async () => createCorrelationLinkDbRecord({
        correlationId: 'corr-123',
        accountId: 'acc-456',
        applicationId: null,
        customerId: null,
        cardNumberLast4: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: fixture,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.correlationId).toBe('corr-123');
      expect(body.accountId).toBe('acc-456');
    });

    it('should create with all optional fields', async () => {
      const fixture = createCorrelationLinkFixture({
        applicationId: 'app-123',
        customerId: 'cust-456',
        cardNumberLast4: '1234',
      });

      mockCreateCorrelationLink = async () => createCorrelationLinkDbRecord({
        applicationId: 'app-123',
        customerId: 'cust-456',
        cardNumberLast4: '1234',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: fixture,
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return ISO timestamp for linkedAt', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      mockCreateCorrelationLink = async () => createCorrelationLinkDbRecord({
        linkedAt: fixedDate,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: createCorrelationLinkFixture(),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.linkedAt).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('validation errors', () => {
    it('should require correlationId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          accountId: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require accountId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          correlationId: 'corr-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty correlationId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          correlationId: '',
          accountId: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid cardNumberLast4 (not 4 digits)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          correlationId: 'corr-123',
          accountId: 'acc-123',
          cardNumberLast4: '123', // Should be 4 characters
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockCreateCorrelationLink = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: createCorrelationLinkFixture(),
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
