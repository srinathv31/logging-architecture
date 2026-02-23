import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  batchUploadRequestSchema,
  batchUploadResponseSchema,
  getEventsByBatchQuerySchema,
  getEventsByBatchResponseSchema,
  batchSummaryResponseSchema,
} from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function batchRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /events/batch/upload — batch upload with shared batchId
  typedApp.post(
    '/batch/upload',
    {
      schema: {
        tags: ['Batch Operations'],
        description: 'Upload a batch of event log entries with a shared batchId',
        body: batchUploadRequestSchema,
        response: { 201: batchUploadResponseSchema },
      },
    },
    async (request, reply) => {
      const { batchId, events } = request.body;
      const { correlationIds, totalInserted, errors } =
        await eventLogService.createBatchUpload(batchId, events);

      return reply.status(201).send({
        success: errors.length === 0,
        batchId,
        totalReceived: events.length,
        totalInserted,
        correlationIds,
        errors: errors.length > 0 ? errors : undefined,
      });
    },
  );

  // GET /events/batch/:batchId — paginated events for a batch
  typedApp.get(
    '/batch/:batchId',
    {
      schema: {
        tags: ['Batch Operations'],
        description: 'Query event logs for a specific batch with optional status filter and pagination',
        params: z.object({ batchId: z.string().min(1) }),
        querystring: getEventsByBatchQuerySchema,
        response: { 200: getEventsByBatchResponseSchema },
      },
    },
    async (request, reply) => {
      const { batchId } = request.params;
      const { page, pageSize, eventStatus } = request.query;

      const result = await eventLogService.getByBatch(batchId, {
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
    },
  );

  // GET /events/batch/:batchId/summary — aggregate batch statistics
  typedApp.get(
    '/batch/:batchId/summary',
    {
      schema: {
        tags: ['Batch Operations'],
        description: 'Get aggregate statistics for a batch of events',
        params: z.object({ batchId: z.string().min(1) }),
        response: { 200: batchSummaryResponseSchema },
      },
    },
    async (request, reply) => {
      const { batchId } = request.params;
      const summary = await eventLogService.getBatchSummary(batchId);

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
    },
  );
}
