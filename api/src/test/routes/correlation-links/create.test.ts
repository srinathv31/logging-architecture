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
import { createCorrelationLinkSchema, createCorrelationLinkResponseSchema } from '../../../schemas/correlation-links';

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
          correlation_id: result.correlationId,
          account_id: result.accountId,
          linked_at: result.linkedAt.toISOString(),
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
        correlationId: fixture.correlation_id,
        accountId: fixture.account_id,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: fixture,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.correlation_id).toBe(fixture.correlation_id);
      expect(body.account_id).toBe(fixture.account_id);
      expect(body.linked_at).toBeDefined();
    });

    it('should create with required fields only', async () => {
      const fixture = {
        correlation_id: 'corr-123',
        account_id: 'acc-456',
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
      expect(body.correlation_id).toBe('corr-123');
      expect(body.account_id).toBe('acc-456');
    });

    it('should create with all optional fields', async () => {
      const fixture = createCorrelationLinkFixture({
        application_id: 'app-123',
        customer_id: 'cust-456',
        card_number_last4: '1234',
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

    it('should return ISO timestamp for linked_at', async () => {
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
      expect(body.linked_at).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('validation errors', () => {
    it('should require correlation_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          account_id: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require account_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          correlation_id: 'corr-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty correlation_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          correlation_id: '',
          account_id: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid card_number_last4 (not 4 digits)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/correlation-links',
        payload: {
          correlation_id: 'corr-123',
          account_id: 'acc-123',
          card_number_last4: '123', // Should be 4 characters
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
