import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { listTracesQuerySchema, listTracesResponseSchema } from '../../../src/schemas/traces';

// Mock function for listTraces
let mockListTraces: (filters: {
  startDate?: string;
  endDate?: string;
  processName?: string;
  eventStatus?: string;
  accountId?: string;
  page: number;
  pageSize: number;
}) => Promise<{
  traces: Array<{
    trace_id: string;
    event_count: number;
    has_errors: boolean;
    latest_status: string;
    duration_ms: number | null;
    process_name: string | null;
    account_id: string | null;
    start_time: string;
    end_time: string;
  }>;
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
      '/',
      {
        schema: {
          querystring: listTracesQuerySchema,
          response: { 200: listTracesResponseSchema },
        },
      },
      async (request, reply) => {
        const { page, page_size, start_date, end_date, process_name, event_status, account_id } =
          request.query;

        const { traces, totalCount, hasMore } = await mockListTraces({
          startDate: start_date,
          endDate: end_date,
          processName: process_name,
          eventStatus: event_status,
          accountId: account_id,
          page,
          pageSize: page_size,
        });

        return reply.send({
          traces,
          total_count: totalCount,
          page,
          page_size,
          has_more: hasMore,
        });
      },
    );
  }, { prefix: '/v1/traces' });

  return app;
}

describe('GET /v1/traces', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockListTraces = async () => ({
      traces: [],
      totalCount: 0,
      hasMore: false,
    });
  });

  describe('successful queries', () => {
    it('should return trace list with default pagination', async () => {
      const mockTraces = [
        {
          trace_id: 'trace-abc',
          event_count: 12,
          has_errors: false,
          latest_status: 'SUCCESS',
          duration_ms: 5000,
          process_name: 'Onboarding',
          account_id: 'ACC-123',
          start_time: '2024-01-01T10:00:00.000Z',
          end_time: '2024-01-01T10:00:05.000Z',
        },
      ];

      mockListTraces = async () => ({
        traces: mockTraces,
        totalCount: 1,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.traces).toHaveLength(1);
      expect(body.traces[0].trace_id).toBe('trace-abc');
      expect(body.traces[0].event_count).toBe(12);
      expect(body.traces[0].has_errors).toBe(false);
      expect(body.traces[0].latest_status).toBe('SUCCESS');
      expect(body.traces[0].duration_ms).toBe(5000);
      expect(body.traces[0].process_name).toBe('Onboarding');
      expect(body.traces[0].account_id).toBe('ACC-123');
      expect(body.total_count).toBe(1);
      expect(body.page).toBe(1);
      expect(body.page_size).toBe(20);
      expect(body.has_more).toBe(false);
    });

    it('should return empty results', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.traces).toHaveLength(0);
      expect(body.total_count).toBe(0);
      expect(body.has_more).toBe(false);
    });

    it('should handle traces with errors', async () => {
      mockListTraces = async () => ({
        traces: [{
          trace_id: 'trace-err',
          event_count: 5,
          has_errors: true,
          latest_status: 'FAILURE',
          duration_ms: 2000,
          process_name: 'Payment',
          account_id: null,
          start_time: '2024-01-01T10:00:00.000Z',
          end_time: '2024-01-01T10:00:02.000Z',
        }],
        totalCount: 1,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.traces[0].has_errors).toBe(true);
      expect(body.traces[0].latest_status).toBe('FAILURE');
      expect(body.traces[0].account_id).toBeNull();
    });
  });

  describe('pagination', () => {
    it('should accept page and page_size query params', async () => {
      mockListTraces = async () => ({
        traces: [{
          trace_id: 'trace-1',
          event_count: 3,
          has_errors: false,
          latest_status: 'SUCCESS',
          duration_ms: 100,
          process_name: 'Test',
          account_id: 'ACC-1',
          start_time: '2024-01-01T10:00:00.000Z',
          end_time: '2024-01-01T10:00:00.100Z',
        }],
        totalCount: 42,
        hasMore: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces?page=2&page_size=10',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.page).toBe(2);
      expect(body.page_size).toBe(10);
      expect(body.total_count).toBe(42);
      expect(body.has_more).toBe(true);
    });
  });

  describe('filters', () => {
    it('should pass filters to service', async () => {
      let capturedFilters: Record<string, unknown> = {};
      mockListTraces = async (filters) => {
        capturedFilters = filters;
        return { traces: [], totalCount: 0, hasMore: false };
      };

      await app.inject({
        method: 'GET',
        url: '/v1/traces?process_name=Onboarding&event_status=FAILURE&account_id=ACC-1',
      });

      expect(capturedFilters.processName).toBe('Onboarding');
      expect(capturedFilters.eventStatus).toBe('FAILURE');
      expect(capturedFilters.accountId).toBe('ACC-1');
    });

    it('should pass date range filters', async () => {
      let capturedFilters: Record<string, unknown> = {};
      mockListTraces = async (filters) => {
        capturedFilters = filters;
        return { traces: [], totalCount: 0, hasMore: false };
      };

      await app.inject({
        method: 'GET',
        url: '/v1/traces?start_date=2024-01-01T00:00:00.000Z&end_date=2024-01-31T23:59:59.000Z',
      });

      expect(capturedFilters.startDate).toBe('2024-01-01T00:00:00.000Z');
      expect(capturedFilters.endDate).toBe('2024-01-31T23:59:59.000Z');
    });
  });

  describe('validation', () => {
    it('should reject invalid event_status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces?event_status=INVALID',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject page_size > 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces?page_size=101',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockListTraces = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces',
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
