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
import { createEventFixture, createEventLogDbRecord } from '../../fixtures/events';
import {
  batchUploadRequestSchema,
  batchUploadResponseSchema,
  getEventsByBatchQuerySchema,
  getEventsByBatchResponseSchema,
  batchSummaryResponseSchema,
} from '../../../src/schemas/events';

// Mock functions
let mockCreateBatchUpload: (batchId: string, events: unknown[]) => Promise<{
  correlationIds: string[];
  totalInserted: number;
  errors: Array<{ index: number; error: string }>;
}>;

let mockGetByBatch: (batchId: string, filters: {
  eventStatus?: string;
  page: number;
  pageSize: number;
}) => Promise<{
  events: unknown[];
  totalCount: number;
  uniqueCorrelationIds: number;
  successCount: number;
  failureCount: number;
  hasMore: boolean;
}>;

let mockGetBatchSummary: (batchId: string) => Promise<{
  totalProcesses: number;
  completed: number;
  inProgress: number;
  failed: number;
  correlationIds: string[];
  startedAt: string | null;
  lastEventAt: string | null;
}>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    // POST /events/batch/upload
    typedApp.post(
      '/batch/upload',
      {
        schema: {
          body: batchUploadRequestSchema,
          response: { 201: batchUploadResponseSchema },
        },
      },
      async (request, reply) => {
        const { batchId, events } = request.body;
        const { correlationIds, totalInserted, errors } =
          await mockCreateBatchUpload(batchId, events);

        return reply.status(201).send({
          success: errors.length === 0,
          batchId,
          totalReceived: events.length,
          totalInserted,
          correlationIds,
          errors: errors.length > 0 ? errors : undefined,
        });
      }
    );

    // GET /events/batch/:batchId
    typedApp.get(
      '/batch/:batchId',
      {
        schema: {
          params: z.object({ batchId: z.string().min(1) }),
          querystring: getEventsByBatchQuerySchema,
          response: { 200: getEventsByBatchResponseSchema },
        },
      },
      async (request, reply) => {
        const { batchId } = request.params;
        const { page, pageSize, eventStatus } = request.query;

        const result = await mockGetByBatch(batchId, {
          eventStatus,
          page,
          pageSize,
        });

        return reply.send({
          batchId,
          events: result.events,
          totalCount: result.totalCount,
          uniqueCorrelationIds: result.uniqueCorrelationIds,
          successCount: result.successCount,
          failureCount: result.failureCount,
          page,
          pageSize,
          hasMore: result.hasMore,
        });
      }
    );

    // GET /events/batch/:batchId/summary
    typedApp.get(
      '/batch/:batchId/summary',
      {
        schema: {
          params: z.object({ batchId: z.string().min(1) }),
          response: { 200: batchSummaryResponseSchema },
        },
      },
      async (request, reply) => {
        const { batchId } = request.params;
        const summary = await mockGetBatchSummary(batchId);

        return reply.send({
          batchId,
          totalProcesses: summary.totalProcesses,
          completed: summary.completed,
          inProgress: summary.inProgress,
          failed: summary.failed,
          correlationIds: summary.correlationIds,
          startedAt: summary.startedAt,
          lastEventAt: summary.lastEventAt,
        });
      }
    );
  }, { prefix: '/v1/events' });

  return app;
}

describe('Batch Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockCreateBatchUpload = async () => ({
      correlationIds: [],
      totalInserted: 0,
      errors: [],
    });
    mockGetByBatch = async () => ({
      events: [],
      totalCount: 0,
      uniqueCorrelationIds: 0,
      successCount: 0,
      failureCount: 0,
      hasMore: false,
    });
    mockGetBatchSummary = async () => ({
      totalProcesses: 0,
      completed: 0,
      inProgress: 0,
      failed: 0,
      correlationIds: [],
      startedAt: null,
      lastEventAt: null,
    });
  });

  describe('POST /v1/events/batch/upload', () => {
    it('should upload batch successfully', async () => {
      mockCreateBatchUpload = async () => ({
        correlationIds: ['corr-1', 'corr-2'],
        totalInserted: 2,
        errors: [],
      });

      const events = [
        createEventFixture({ correlationId: 'corr-1' }),
        createEventFixture({ correlationId: 'corr-2' }),
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch/upload',
        payload: {
          batchId: 'batch-123',
          events,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.batchId).toBe('batch-123');
      expect(body.totalReceived).toBe(2);
      expect(body.totalInserted).toBe(2);
      expect(body.correlationIds).toHaveLength(2);
      expect(body.errors).toBeUndefined();
    });

    it('should report partial failures', async () => {
      mockCreateBatchUpload = async () => ({
        correlationIds: ['corr-1'],
        totalInserted: 1,
        errors: [{ index: 1, error: 'Duplicate key' }],
      });

      const events = [
        createEventFixture({ correlationId: 'corr-1' }),
        createEventFixture({ correlationId: 'corr-2' }),
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch/upload',
        payload: {
          batchId: 'batch-123',
          events,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.totalInserted).toBe(1);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].index).toBe(1);
    });

    it('should require batchId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch/upload',
        payload: {
          events: [createEventFixture()],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require at least one event', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch/upload',
        payload: {
          batchId: 'batch-123',
          events: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle service errors gracefully', async () => {
      mockCreateBatchUpload = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events/batch/upload',
        payload: {
          batchId: 'batch-123',
          events: [createEventFixture()],
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /v1/events/batch/:batchId', () => {
    it('should return events for a batch', async () => {
      mockGetByBatch = async () => ({
        events: [createEventLogDbRecord({ batchId: 'batch-123' })],
        totalCount: 1,
        uniqueCorrelationIds: 1,
        successCount: 1,
        failureCount: 0,
        hasMore: false,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.batchId).toBe('batch-123');
      expect(body.events).toHaveLength(1);
      expect(body.totalCount).toBe(1);
      expect(body.uniqueCorrelationIds).toBe(1);
      expect(body.successCount).toBe(1);
      expect(body.failureCount).toBe(0);
    });

    it('should filter by eventStatus', async () => {
      let capturedFilters: { eventStatus?: string } | null = null;
      mockGetByBatch = async (_, filters) => {
        capturedFilters = filters;
        return {
          events: [],
          totalCount: 0,
          uniqueCorrelationIds: 0,
          successCount: 0,
          failureCount: 0,
          hasMore: false,
        };
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123?eventStatus=FAILURE',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.eventStatus).toBe('FAILURE');
    });

    it('should pass pagination parameters correctly', async () => {
      let capturedFilters: { page: number; pageSize: number } | null = null;
      mockGetByBatch = async (_, filters) => {
        capturedFilters = filters;
        return {
          events: [],
          totalCount: 100,
          uniqueCorrelationIds: 10,
          successCount: 8,
          failureCount: 2,
          hasMore: true,
        };
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123?page=2&pageSize=25',
      });

      expect(response.statusCode).toBe(200);
      expect(capturedFilters?.page).toBe(2);
      expect(capturedFilters?.pageSize).toBe(25);
    });

    it('should indicate hasMore when more pages exist', async () => {
      mockGetByBatch = async () => ({
        events: [createEventLogDbRecord()],
        totalCount: 100,
        uniqueCorrelationIds: 10,
        successCount: 8,
        failureCount: 2,
        hasMore: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.hasMore).toBe(true);
    });

    it('should handle service errors gracefully', async () => {
      mockGetByBatch = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /v1/events/batch/:batchId/summary', () => {
    it('should return batch summary statistics', async () => {
      mockGetBatchSummary = async () => ({
        totalProcesses: 10,
        completed: 7,
        inProgress: 2,
        failed: 1,
        correlationIds: ['corr-1', 'corr-2', 'corr-3'],
        startedAt: '2024-01-01T00:00:00.000Z',
        lastEventAt: '2024-01-01T01:00:00.000Z',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.batchId).toBe('batch-123');
      expect(body.totalProcesses).toBe(10);
      expect(body.completed).toBe(7);
      expect(body.inProgress).toBe(2);
      expect(body.failed).toBe(1);
      expect(body.correlationIds).toHaveLength(3);
      expect(body.startedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(body.lastEventAt).toBe('2024-01-01T01:00:00.000Z');
    });

    it('should handle null timestamps', async () => {
      mockGetBatchSummary = async () => ({
        totalProcesses: 0,
        completed: 0,
        inProgress: 0,
        failed: 0,
        correlationIds: [],
        startedAt: null,
        lastEventAt: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.startedAt).toBeNull();
      expect(body.lastEventAt).toBeNull();
    });

    it('should handle empty batch', async () => {
      mockGetBatchSummary = async () => ({
        totalProcesses: 0,
        completed: 0,
        inProgress: 0,
        failed: 0,
        correlationIds: [],
        startedAt: null,
        lastEventAt: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/unknown-batch/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.totalProcesses).toBe(0);
    });

    it('should handle service errors gracefully', async () => {
      mockGetBatchSummary = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'GET',
        url: '/v1/events/batch/batch-123/summary',
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
