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
import { eventLogPaginationQuerySchema } from '../../../src/schemas/common';

// Mock function for getByCorrelation
let mockGetByCorrelation: (correlationId: string, pagination: { page: number; pageSize: number }) => Promise<{
  events: unknown[];
  accountId: string | null;
  isLinked: boolean;
  totalCount: number;
  hasMore: boolean;
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
          querystring: eventLogPaginationQuerySchema,
          response: { 200: getEventsByCorrelationResponseSchema },
        },
      },
      async (request, reply) => {
        const { correlationId } = request.params;
        const { page, pageSize } = request.query;
        const { events, accountId, isLinked, totalCount, hasMore } =
          await mockGetByCorrelation(correlationId, { page, pageSize });

        return reply.send({
          correlationId,
          accountId,
          events,
          isLinked,
          totalCount,
          page,
          pageSize,
          hasMore,
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
      totalCount: 0,
      hasMore: false,
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
        totalCount: 2,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.correlationId).toBe('corr-123');
      expect(body.events).toHaveLength(2);
      expect(body.accountId).toBe('acc-123');
      expect(body.isLinked).toBe(true);
      expect(body.totalCount).toBe(2);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(200);
      expect(body.hasMore).toBe(false);
    });

    it('should return empty events for unknown correlation ID', async () => {
      mockGetByCorrelation = async () => ({
        events: [],
        accountId: null,
        isLinked: false,
        totalCount: 0,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/unknown-corr',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.events).toHaveLength(0);
      expect(body.isLinked).toBe(false);
    });

    it('should return null accountId when not linked', async () => {
      mockGetByCorrelation = async () => ({
        events: [createEventLogDbRecord()],
        accountId: null,
        isLinked: false,
        totalCount: 1,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.accountId).toBeNull();
      expect(body.isLinked).toBe(false);
    });

    it('should handle complex correlation IDs', async () => {
      mockGetByCorrelation = async () => ({
        events: [createEventLogDbRecord()],
        accountId: 'acc-123',
        isLinked: true,
        totalCount: 1,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123-abc-456',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.correlationId).toBe('corr-123-abc-456');
    });
  });

  describe('pagination', () => {
    it('should accept page and pageSize query params', async () => {
      mockGetByCorrelation = async (_id, pagination) => ({
        events: [createEventLogDbRecord()],
        accountId: null,
        isLinked: false,
        totalCount: 10,
        hasMore: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/correlation/corr-123?page=2&pageSize=5',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.page).toBe(2);
      expect(body.pageSize).toBe(5);
      expect(body.totalCount).toBe(10);
      expect(body.hasMore).toBe(true);
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
