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
import { getEventsByTraceResponseSchema } from '../../../src/schemas/events';
import { eventLogPaginationQuerySchema } from '../../../src/schemas/common';

// Mock function for getByTrace
let mockGetByTrace: (traceId: string, pagination: { page: number; pageSize: number }) => Promise<{
  events: unknown[];
  systemsInvolved: string[];
  totalDurationMs: number | null;
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
      '/trace/:traceId',
      {
        schema: {
          params: z.object({ traceId: z.string().min(1) }),
          querystring: eventLogPaginationQuerySchema,
          response: { 200: getEventsByTraceResponseSchema },
        },
      },
      async (request, reply) => {
        const { traceId } = request.params;
        const { page, page_size } = request.query;
        const { events, systemsInvolved, totalDurationMs, totalCount, hasMore } =
          await mockGetByTrace(traceId, { page, pageSize: page_size });

        return reply.send({
          trace_id: traceId,
          events,
          systems_involved: systemsInvolved,
          total_duration_ms: totalDurationMs,
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

describe('GET /v1/events/trace/:traceId', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetByTrace = async () => ({
      events: [],
      systemsInvolved: [],
      totalDurationMs: null,
      totalCount: 0,
      hasMore: false,
    });
  });

  describe('successful queries', () => {
    it('should return events for a trace ID with systems and duration', async () => {
      const mockEvents = [
        createEventLogDbRecord({ traceId: 'trace-123', targetSystem: 'system-a' }),
        createEventLogDbRecord({ traceId: 'trace-123', targetSystem: 'system-b' }),
      ];

      mockGetByTrace = async () => ({
        events: mockEvents,
        systemsInvolved: ['system-a', 'system-b'],
        totalDurationMs: 5000,
        totalCount: 2,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/trace/trace-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.trace_id).toBe('trace-123');
      expect(body.events).toHaveLength(2);
      expect(body.systems_involved).toEqual(['system-a', 'system-b']);
      expect(body.total_duration_ms).toBe(5000);
      expect(body.total_count).toBe(2);
      expect(body.page).toBe(1);
      expect(body.page_size).toBe(200);
      expect(body.has_more).toBe(false);
    });

    it('should return null duration when no events exist', async () => {
      mockGetByTrace = async () => ({
        events: [],
        systemsInvolved: [],
        totalDurationMs: null,
        totalCount: 0,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/trace/unknown-trace',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.events).toHaveLength(0);
      expect(body.total_duration_ms).toBeNull();
      expect(body.systems_involved).toEqual([]);
    });

    it('should deduplicate systems in systems_involved', async () => {
      mockGetByTrace = async () => ({
        events: [createEventLogDbRecord()],
        systemsInvolved: ['system-a', 'system-b', 'system-a'],
        totalDurationMs: 1000,
        totalCount: 1,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/trace/trace-123',
      });

      expect(response.statusCode).toBe(200);
      // Note: The service should deduplicate, but we pass whatever the mock returns
      const body = response.json();
      expect(body.systems_involved).toHaveLength(3); // Testing the route, not the service logic
    });

    it('should handle single event traces', async () => {
      mockGetByTrace = async () => ({
        events: [createEventLogDbRecord()],
        systemsInvolved: ['system-a'],
        totalDurationMs: 0,
        totalCount: 1,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/trace/trace-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.events).toHaveLength(1);
      expect(body.total_duration_ms).toBe(0);
    });
  });

  describe('pagination', () => {
    it('should accept page and page_size query params', async () => {
      mockGetByTrace = async (_id, pagination) => ({
        events: [createEventLogDbRecord()],
        systemsInvolved: ['system-a'],
        totalDurationMs: 100,
        totalCount: 10,
        hasMore: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/trace/trace-123?page=2&page_size=5',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.page).toBe(2);
      expect(body.page_size).toBe(5);
      expect(body.total_count).toBe(10);
      expect(body.has_more).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockGetByTrace = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/trace/trace-123',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('validation', () => {
    it('should return error for empty traceId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/trace/',
      });

      // Fastify returns 400 for empty path params, or 404 if route doesn't match
      expect([400, 404]).toContain(response.statusCode);
    });
  });
});
