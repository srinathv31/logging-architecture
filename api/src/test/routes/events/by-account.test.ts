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
import { getEventsByAccountQuerySchema, getEventsByAccountResponseSchema } from '../../../schemas/events';

// Mock functions that will be configured per test
let mockGetByAccount: (
  accountId: string,
  filters: {
    startDate?: string;
    endDate?: string;
    processName?: string;
    eventStatus?: string;
    includeLinked?: boolean;
    page: number;
    pageSize: number;
  }
) => Promise<{ events: unknown[]; totalCount: number; hasMore: boolean }>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.get(
      '/account/:accountId',
      {
        schema: {
          params: z.object({ accountId: z.string().min(1) }),
          querystring: getEventsByAccountQuerySchema,
          response: { 200: getEventsByAccountResponseSchema },
        },
      },
      async (request, reply) => {
        const { accountId } = request.params;
        const { page, page_size, start_date, end_date, process_name, event_status, include_linked } =
          request.query;

        const { events, totalCount, hasMore } = await mockGetByAccount(accountId, {
          startDate: start_date,
          endDate: end_date,
          processName: process_name,
          eventStatus: event_status,
          includeLinked: include_linked,
          page,
          pageSize: page_size,
        });

        return reply.send({
          account_id: accountId,
          events,
          total_count: totalCount,
          page,
          page_size,
          has_more: hasMore,
        });
      }
    );
  }, { prefix: '/v1/events' });

  return app;
}

describe('GET /v1/events/account/:accountId', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetByAccount = async () => ({
      events: [],
      totalCount: 0,
      hasMore: false,
    });
  });

  describe('successful queries', () => {
    it('should return events for an account with default pagination', async () => {
      const mockEvents = [createEventLogDbRecord({ accountId: 'acc-123' })];
      mockGetByAccount = async (accountId) => ({
        events: mockEvents,
        totalCount: 1,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.account_id).toBe('acc-123');
      expect(body.events).toHaveLength(1);
      expect(body.total_count).toBe(1);
      expect(body.has_more).toBe(false);
      expect(body.page).toBe(1);
      expect(body.page_size).toBe(20);
    });

    it('should return empty array when no events exist', async () => {
      mockGetByAccount = async () => ({
        events: [],
        totalCount: 0,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/nonexistent',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.events).toHaveLength(0);
      expect(body.total_count).toBe(0);
    });

    it('should pass pagination parameters correctly', async () => {
      let capturedFilters: { page: number; pageSize: number } | null = null;
      mockGetByAccount = async (_, filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 100, hasMore: true };
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?page=3&page_size=50',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.page).toBe(3);
      expect(capturedFilters?.pageSize).toBe(50);
    });

    it('should pass date range filters correctly', async () => {
      let capturedFilters: { startDate?: string; endDate?: string } | null = null;
      mockGetByAccount = async (_, filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0, hasMore: false };
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.startDate).toBe('2024-01-01T00:00:00Z');
      expect(capturedFilters?.endDate).toBe('2024-01-31T23:59:59Z');
    });

    it('should pass process_name filter correctly', async () => {
      let capturedFilters: { processName?: string } | null = null;
      mockGetByAccount = async (_, filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0, hasMore: false };
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?process_name=payment-process',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.processName).toBe('payment-process');
    });

    it('should pass event_status filter correctly', async () => {
      let capturedFilters: { eventStatus?: string } | null = null;
      mockGetByAccount = async (_, filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0, hasMore: false };
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?event_status=FAILURE',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.eventStatus).toBe('FAILURE');
    });

    it('should pass include_linked=true correctly', async () => {
      let capturedFilters: { includeLinked?: boolean } | null = null;
      mockGetByAccount = async (_, filters) => {
        capturedFilters = filters;
        return { events: [], totalCount: 0, hasMore: false };
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?include_linked=true',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.includeLinked).toBe(true);
    });

    it('should indicate has_more when more pages exist', async () => {
      mockGetByAccount = async () => ({
        events: [createEventLogDbRecord()],
        totalCount: 100,
        hasMore: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?page_size=10',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.has_more).toBe(true);
      expect(body.total_count).toBe(100);
    });
  });

  describe('validation errors', () => {
    it('should return error for empty accountId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/',
      });

      // Fastify returns 400 for empty path params, or 404 if route doesn't match
      expect([400, 404]).toContain(response.statusCode);
    });

    it('should return 400 for invalid page number', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?page=0',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid page_size', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?page_size=0',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid event_status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123?event_status=INVALID',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockGetByAccount = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123',
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
