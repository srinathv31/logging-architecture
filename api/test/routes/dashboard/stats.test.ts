import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { dashboardStatsQuerySchema, dashboardStatsResponseSchema } from '../../../src/schemas/dashboard';

// Mock function for getDashboardStats
let mockGetDashboardStats: (filters: {
  startDate?: string;
  endDate?: string;
}) => Promise<{
  totalTraces: number;
  totalAccounts: number;
  totalEvents: number;
  successRate: number;
  systemNames: string[];
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
      '/stats',
      {
        schema: {
          querystring: dashboardStatsQuerySchema,
          response: { 200: dashboardStatsResponseSchema },
        },
      },
      async (request, reply) => {
        const { startDate, endDate } = request.query;

        const stats = await mockGetDashboardStats({
          startDate,
          endDate,
        });

        return reply.send({
          totalTraces: stats.totalTraces,
          totalAccounts: stats.totalAccounts,
          totalEvents: stats.totalEvents,
          successRate: stats.successRate,
          systemNames: stats.systemNames,
        });
      },
    );
  }, { prefix: '/v1/dashboard' });

  return app;
}

describe('GET /v1/dashboard/stats', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetDashboardStats = async () => ({
      totalTraces: 0,
      totalAccounts: 0,
      totalEvents: 0,
      successRate: 100,
      systemNames: [],
    });
  });

  describe('successful queries', () => {
    it('should return aggregate stats', async () => {
      mockGetDashboardStats = async () => ({
        totalTraces: 500,
        totalAccounts: 120,
        totalEvents: 15000,
        successRate: 95.5,
        systemNames: ['system-a', 'system-b'],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.totalTraces).toBe(500);
      expect(body.totalAccounts).toBe(120);
      expect(body.totalEvents).toBe(15000);
      expect(body.successRate).toBe(95.5);
      expect(body.systemNames).toEqual(['system-a', 'system-b']);
    });

    it('should return defaults for zero traces', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.totalTraces).toBe(0);
      expect(body.totalAccounts).toBe(0);
      expect(body.totalEvents).toBe(0);
      expect(body.successRate).toBe(100);
      expect(body.systemNames).toEqual([]);
    });
  });

  describe('date filters', () => {
    it('should pass date range to service', async () => {
      let capturedFilters: Record<string, unknown> = {};
      mockGetDashboardStats = async (filters) => {
        capturedFilters = filters;
        return {
          totalTraces: 10,
          totalAccounts: 5,
          totalEvents: 100,
          successRate: 90,
          systemNames: ['system-a'],
        };
      };

      await app.inject({
        method: 'GET',
        url: '/v1/dashboard/stats?startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-31T23:59:59.000Z',
      });

      expect(capturedFilters.startDate).toBe('2024-01-01T00:00:00.000Z');
      expect(capturedFilters.endDate).toBe('2024-01-31T23:59:59.000Z');
    });

    it('should work without date filters', async () => {
      mockGetDashboardStats = async () => ({
        totalTraces: 100,
        totalAccounts: 50,
        totalEvents: 1000,
        successRate: 98,
        systemNames: ['system-x'],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.totalTraces).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockGetDashboardStats = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard/stats',
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
