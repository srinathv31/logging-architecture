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
import { createAccountSummaryDbRecord } from '../../fixtures/account-summary';
import { accountSummaryResponseSchema } from '../../../src/schemas/events';
import { NotFoundError } from '../../../src/utils/errors';
import { registerErrorHandler } from '../../../src/plugins/error-handler';

// Mock function for getAccountSummary
let mockGetAccountSummary: (accountId: string) => Promise<{
  summary: ReturnType<typeof createAccountSummaryDbRecord>;
  recentEvents: unknown[];
  recentErrors: unknown[];
}>;

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
      '/account/:accountId/summary',
      {
        schema: {
          params: z.object({ accountId: z.string().min(1) }),
          response: { 200: accountSummaryResponseSchema },
        },
      },
      async (request, reply) => {
        const { accountId } = request.params;
        const { summary, recentEvents, recentErrors } = await mockGetAccountSummary(accountId);

        return reply.send({
          summary: {
            account_id: summary.accountId,
            first_event_at: summary.firstEventAt.toISOString(),
            last_event_at: summary.lastEventAt.toISOString(),
            total_events: summary.totalEvents,
            total_processes: summary.totalProcesses,
            error_count: summary.errorCount,
            last_process: summary.lastProcess,
            systems_touched: summary.systemsTouched,
            correlation_ids: summary.correlationIds,
            updated_at: summary.updatedAt.toISOString(),
          },
          recent_events: recentEvents,
          recent_errors: recentErrors,
        });
      }
    );
  }, { prefix: '/v1/events' });

  return app;
}

describe('GET /v1/events/account/:accountId/summary', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockGetAccountSummary = async () => ({
      summary: createAccountSummaryDbRecord(),
      recentEvents: [],
      recentErrors: [],
    });
  });

  describe('successful queries', () => {
    it('should return account summary with all data', async () => {
      const mockSummary = createAccountSummaryDbRecord({ accountId: 'acc-123' });
      const mockRecentEvents = [createEventLogDbRecord()];
      const mockRecentErrors = [createEventLogDbRecord({ eventStatus: 'FAILURE' })];

      mockGetAccountSummary = async () => ({
        summary: mockSummary,
        recentEvents: mockRecentEvents,
        recentErrors: mockRecentErrors,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.summary.account_id).toBe('acc-123');
      expect(body.summary.total_events).toBe(100);
      expect(body.summary.total_processes).toBe(10);
      expect(body.summary.error_count).toBe(5);
      expect(body.summary.last_process).toBe('test-process');
      expect(body.summary.systems_touched).toEqual(['system-a', 'system-b', 'system-c']);
      expect(body.recent_events).toHaveLength(1);
      expect(body.recent_errors).toHaveLength(1);
    });

    it('should return timestamps as ISO strings', async () => {
      const mockSummary = createAccountSummaryDbRecord({
        firstEventAt: new Date('2024-01-01T00:00:00Z'),
        lastEventAt: new Date('2024-01-15T12:00:00Z'),
      });

      mockGetAccountSummary = async () => ({
        summary: mockSummary,
        recentEvents: [],
        recentErrors: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.summary.first_event_at).toBe('2024-01-01T00:00:00.000Z');
      expect(body.summary.last_event_at).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should handle empty recent events and errors', async () => {
      mockGetAccountSummary = async () => ({
        summary: createAccountSummaryDbRecord(),
        recentEvents: [],
        recentErrors: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.recent_events).toHaveLength(0);
      expect(body.recent_errors).toHaveLength(0);
    });

    it('should handle null correlation_ids', async () => {
      mockGetAccountSummary = async () => ({
        summary: createAccountSummaryDbRecord({ correlationIds: null }),
        recentEvents: [],
        recentErrors: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.summary.correlation_ids).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return 404 when account not found', async () => {
      mockGetAccountSummary = async (accountId) => {
        throw new NotFoundError(`Account summary not found for account_id: ${accountId}`);
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/nonexistent/summary',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('should handle service errors gracefully', async () => {
      mockGetAccountSummary = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account/acc-123/summary',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('validation', () => {
    it('should return error for empty accountId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/account//summary',
      });

      // Fastify returns 400 for empty path params, or 404 if route doesn't match
      expect([400, 404]).toContain(response.statusCode);
    });
  });
});
