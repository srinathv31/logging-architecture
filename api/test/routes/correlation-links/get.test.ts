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
import { createCorrelationLinkDbRecord } from '../../fixtures/correlation-links';
import { getCorrelationLinkResponseSchema } from '../../../src/schemas/correlation-links';
import { NotFoundError } from '../../../src/utils/errors';
import { registerErrorHandler } from '../../../src/plugins/error-handler';

// Mock function for getCorrelationLink
let mockGetCorrelationLink: (correlationId: string) => Promise<ReturnType<typeof createCorrelationLinkDbRecord>>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  registerErrorHandler(app);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.get(
      '/:correlationId',
      {
        schema: {
          params: z.object({ correlationId: z.string().min(1) }),
          response: { 200: getCorrelationLinkResponseSchema },
        },
      },
      async (request, reply) => {
        const { correlationId } = request.params;
        const link = await mockGetCorrelationLink(correlationId);

        return reply.send({
          correlation_id: link.correlationId,
          account_id: link.accountId,
          application_id: link.applicationId,
          customer_id: link.customerId,
          card_number_last4: link.cardNumberLast4,
          linked_at: link.linkedAt.toISOString(),
        });
      }
    );
  }, { prefix: '/v1/correlation-links' });

  return app;
}

describe('GET /v1/correlation-links/:correlationId', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetCorrelationLink = async () => createCorrelationLinkDbRecord();
  });

  describe('successful retrieval', () => {
    it('should return correlation link by ID', async () => {
      mockGetCorrelationLink = async () => createCorrelationLinkDbRecord({
        correlationId: 'corr-123',
        accountId: 'acc-456',
        applicationId: 'app-789',
        customerId: 'cust-000',
        cardNumberLast4: '1234',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/correlation-links/corr-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.correlation_id).toBe('corr-123');
      expect(body.account_id).toBe('acc-456');
      expect(body.application_id).toBe('app-789');
      expect(body.customer_id).toBe('cust-000');
      expect(body.card_number_last4).toBe('1234');
      expect(body.linked_at).toBeDefined();
    });

    it('should return null for optional fields when not set', async () => {
      mockGetCorrelationLink = async () => createCorrelationLinkDbRecord({
        applicationId: null,
        customerId: null,
        cardNumberLast4: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/correlation-links/corr-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.application_id).toBeNull();
      expect(body.customer_id).toBeNull();
      expect(body.card_number_last4).toBeNull();
    });

    it('should return ISO timestamp for linked_at', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      mockGetCorrelationLink = async () => createCorrelationLinkDbRecord({
        linkedAt: fixedDate,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/correlation-links/corr-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.linked_at).toBe('2024-01-15T12:00:00.000Z');
    });
  });

  describe('error handling', () => {
    it('should return 404 when correlation link not found', async () => {
      mockGetCorrelationLink = async (correlationId) => {
        throw new NotFoundError(`Correlation link not found for correlation_id: ${correlationId}`);
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/correlation-links/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('should handle service errors gracefully', async () => {
      mockGetCorrelationLink = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/correlation-links/corr-123',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('validation', () => {
    it('should return error for empty correlationId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/correlation-links/',
      });

      // Fastify returns 400 for empty path params, or 404 if route doesn't match
      expect([400, 404]).toContain(response.statusCode);
    });
  });
});
