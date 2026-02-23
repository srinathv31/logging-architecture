import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createEventLogDbRecord } from '../../fixtures/events';
import { textSearchRequestSchema, textSearchResponseSchema } from '../../../src/schemas/events';

// Mock function for searchText
let mockSearchText: (filters: {
  query: string;
  accountId?: string;
  processName?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) => Promise<{ events: unknown[]; totalCount: number }>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.post(
      '/search/text',
      {
        schema: {
          body: textSearchRequestSchema,
          response: { 200: textSearchResponseSchema },
        },
      },
      async (request, reply) => {
        const { query, accountId, processName, startDate, endDate, page, pageSize } =
          request.body;

        const { events, totalCount } = await mockSearchText({
          query,
          accountId,
          processName,
          startDate,
          endDate,
          page,
          pageSize,
        });

        return reply.send({
          query,
          events,
          totalCount,
          page,
          pageSize,
        });
      }
    );
  }, { prefix: '/v1/events' });

  return app;
}

describe('POST /v1/events/search/text', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockSearchText = async () => ({
      events: [],
      totalCount: 0,
    });
  });

  describe('successful searches', () => {
    it('should search with query and return matching events', async () => {
      const mockEvents = [createEventLogDbRecord({ summary: 'Payment processed successfully' })];

      mockSearchText = async () => ({
        events: mockEvents,
        totalCount: 1,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'payment',
          accountId: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.query).toBe('payment');
      expect(body.events).toHaveLength(1);
      expect(body.totalCount).toBe(1);
    });

    it('should return empty results for no matches', async () => {
      mockSearchText = async () => ({
        events: [],
        totalCount: 0,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'nonexistent-query',
          accountId: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.events).toHaveLength(0);
      expect(body.totalCount).toBe(0);
    });

    it('should pass accountId filter correctly', async () => {
      let capturedFilters: { accountId?: string } | null = null;
      mockSearchText = async (filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0 };
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          accountId: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.accountId).toBe('acc-123');
    });

    it('should pass processName filter correctly', async () => {
      let capturedFilters: { processName?: string } | null = null;
      mockSearchText = async (filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0 };
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          processName: 'payment-process',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.processName).toBe('payment-process');
    });

    it('should pass date range filters correctly', async () => {
      let capturedFilters: { startDate?: string; endDate?: string } | null = null;
      mockSearchText = async (filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0 };
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          accountId: 'acc-123',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-30T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.startDate).toBe('2024-01-01T00:00:00Z');
      expect(capturedFilters?.endDate).toBe('2024-01-30T00:00:00Z');
    });

    it('should pass pagination parameters correctly', async () => {
      let capturedFilters: { page: number; pageSize: number } | null = null;
      mockSearchText = async (filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 100 };
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          accountId: 'acc-123',
          page: 3,
          pageSize: 50,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.page).toBe(3);
      expect(capturedFilters?.pageSize).toBe(50);
    });

    it('should use default pagination values', async () => {
      let capturedFilters: { page: number; pageSize: number } | null = null;
      mockSearchText = async (filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0 };
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          processName: 'payment-process',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.page).toBe(1);
      expect(capturedFilters?.pageSize).toBe(20);
    });
  });

  describe('validation errors', () => {
    it('should require query parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid page number', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          accountId: 'acc-123',
          page: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require accountId or processName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject date windows over 30 days', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          accountId: 'acc-123',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-02-15T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject pageSize above 50', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          accountId: 'acc-123',
          pageSize: 100,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockSearchText = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/search/text',
        payload: {
          query: 'test',
          accountId: 'acc-123',
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
