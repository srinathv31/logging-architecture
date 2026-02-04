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
import { createEventLogDbRecord } from '../../fixtures/events';
import { getEventsByCorrelationResponseSchema } from '../../../src/schemas/events';

// Mock function for getByCorrelation
let mockGetByCorrelation: (correlationId: string) => Promise<{
  events: unknown[];
  accountId: string | null;
  isLinked: boolean;
}>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.get(
      '/correlation/:correlationId',
      {
        schema: {
          params: z.object({ correlationId: z.string().min(1) }),
          response: { 200: getEventsByCorrelationResponseSchema },
        },
      },
      async (request, reply) => {
        const { correlationId } = request.params;
        const { events, accountId, isLinked } = await mockGetByCorrelation(correlationId);

        return reply.send({
          correlation_id: correlationId,
          account_id: accountId,
          events,
          is_linked: isLinked,
        });
      }
    );
  }, { prefix: '/v1/events' });

  return app;
}

describe('GET /v1/events/correlation/:correlationId', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetByCorrelation = async () => ({
      events: [],
      accountId: null,
      isLinked: false,
    });
  });

  describe('successful queries', () => {
    it('should return events for a correlation ID', async () => {
      const mockEvents = [
        createEventLogDbRecord({ correlationId: 'corr-123', stepSequence: 1 }),
        createEventLogDbRecord({ correlationId: 'corr-123', stepSequence: 2 }),
      ];

      mockGetByCorrelation = async () => ({
        events: mockEvents,
        accountId: 'acc-123',
        isLinked: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.correlation_id).toBe('corr-123');
      expect(body.events).toHaveLength(2);
      expect(body.account_id).toBe('acc-123');
      expect(body.is_linked).toBe(true);
    });

    it('should return empty events for unknown correlation ID', async () => {
      mockGetByCorrelation = async () => ({
        events: [],
        accountId: null,
        isLinked: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/unknown-corr',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.events).toHaveLength(0);
      expect(body.is_linked).toBe(false);
    });

    it('should return null account_id when not linked', async () => {
      mockGetByCorrelation = async () => ({
        events: [createEventLogDbRecord()],
        accountId: null,
        isLinked: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.account_id).toBeNull();
      expect(body.is_linked).toBe(false);
    });

    it('should handle complex correlation IDs', async () => {
      mockGetByCorrelation = async () => ({
        events: [createEventLogDbRecord()],
        accountId: 'acc-123',
        isLinked: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123-abc-456',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.correlation_id).toBe('corr-123-abc-456');
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockGetByCorrelation = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('validation', () => {
    it('should return error for empty correlationId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/',
      });

      // Fastify returns 400 for empty path params, or 404 if route doesn't match
      expect([400, 404]).toContain(response.statusCode);
    });
  });
});
