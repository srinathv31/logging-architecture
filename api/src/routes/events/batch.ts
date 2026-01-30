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

  // POST /events/batch/upload — batch upload with shared batch_id
  typedApp.post(
    '/batch/upload',
    {
      schema: {
        tags: ['Batch Operations'],
        description: 'Upload a batch of event log entries with a shared batch_id',
        body: batchUploadRequestSchema,
        response: { 201: batchUploadResponseSchema },
      },
    },
    async (request, reply) => {
      const { batch_id, events } = request.body;
      const { correlationIds, totalInserted, errors } =
        await eventLogService.createBatchUpload(batch_id, events);

      return reply.status(201).send({
        success: errors.length === 0,
        batch_id,
        total_received: events.length,
        total_inserted: totalInserted,
        correlation_ids: correlationIds,
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
      const { page, page_size, event_status } = request.query;

      const result = await eventLogService.getByBatch(batchId, {
        eventStatus: event_status,
        page,
        pageSize: page_size,
      });

      return reply.send({
        batch_id: batchId,
        events: result.events,
        total_count: result.totalCount,
        unique_correlation_ids: result.uniqueCorrelationIds,
        success_count: result.successCount,
        failure_count: result.failureCount,
        page,
        page_size,
        has_more: result.hasMore,
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
        batch_id: batchId,
        total_processes: summary.totalProcesses,
        completed: summary.completed,
        in_progress: summary.inProgress,
        failed: summary.failed,
        correlation_ids: summary.correlationIds,
        started_at: summary.startedAt,
        last_event_at: summary.lastEventAt,
      });
    },
  );
}
