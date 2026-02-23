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
    traceId: string;
    eventCount: number;
    hasErrors: boolean;
    latestStatus: string;
    durationMs: number | null;
    processName: string | null;
    accountId: string | null;
    startTime: string;
    endTime: string;
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
        const { page, pageSize, startDate, endDate, processName, eventStatus, accountId } =
          request.query;

        const { traces, totalCount, hasMore } = await mockListTraces({
          startDate,
          endDate,
          processName,
          eventStatus,
          accountId,
          page,
          pageSize,
        });

        return reply.send({
          traces,
          totalCount,
          page,
          pageSize,
          hasMore,
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
          traceId: 'trace-abc',
          eventCount: 12,
          hasErrors: false,
          latestStatus: 'SUCCESS',
          durationMs: 5000,
          processName: 'Onboarding',
          accountId: 'ACC-123',
          startTime: '2024-01-01T10:00:00.000Z',
          endTime: '2024-01-01T10:00:05.000Z',
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
      expect(body.traces[0].traceId).toBe('trace-abc');
      expect(body.traces[0].eventCount).toBe(12);
      expect(body.traces[0].hasErrors).toBe(false);
      expect(body.traces[0].latestStatus).toBe('SUCCESS');
      expect(body.traces[0].durationMs).toBe(5000);
      expect(body.traces[0].processName).toBe('Onboarding');
      expect(body.traces[0].accountId).toBe('ACC-123');
      expect(body.totalCount).toBe(1);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(20);
      expect(body.hasMore).toBe(false);
    });

    it('should return empty results', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.traces).toHaveLength(0);
      expect(body.totalCount).toBe(0);
      expect(body.hasMore).toBe(false);
    });

    it('should handle traces with errors', async () => {
      mockListTraces = async () => ({
        traces: [{
          traceId: 'trace-err',
          eventCount: 5,
          hasErrors: true,
          latestStatus: 'FAILURE',
          durationMs: 2000,
          processName: 'Payment',
          accountId: null,
          startTime: '2024-01-01T10:00:00.000Z',
          endTime: '2024-01-01T10:00:02.000Z',
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
      expect(body.traces[0].hasErrors).toBe(true);
      expect(body.traces[0].latestStatus).toBe('FAILURE');
      expect(body.traces[0].accountId).toBeNull();
    });
  });

  describe('pagination', () => {
    it('should accept page and pageSize query params', async () => {
      mockListTraces = async () => ({
        traces: [{
          traceId: 'trace-1',
          eventCount: 3,
          hasErrors: false,
          latestStatus: 'SUCCESS',
          durationMs: 100,
          processName: 'Test',
          accountId: 'ACC-1',
          startTime: '2024-01-01T10:00:00.000Z',
          endTime: '2024-01-01T10:00:00.100Z',
        }],
        totalCount: 42,
        hasMore: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces?page=2&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.page).toBe(2);
      expect(body.pageSize).toBe(10);
      expect(body.totalCount).toBe(42);
      expect(body.hasMore).toBe(true);
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
        url: '/v1/traces?processName=Onboarding&eventStatus=FAILURE&accountId=ACC-1',
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
        url: '/v1/traces?startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-31T23:59:59.000Z',
      });

      expect(capturedFilters.startDate).toBe('2024-01-01T00:00:00.000Z');
      expect(capturedFilters.endDate).toBe('2024-01-31T23:59:59.000Z');
    });
  });

  describe('validation', () => {
    it('should reject invalid eventStatus', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces?eventStatus=INVALID',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject pageSize > 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/traces?pageSize=101',
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
