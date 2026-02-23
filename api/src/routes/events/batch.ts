import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  batchCreateEventRequestSchema,
  batchCreateEventResponseSchema,
  getEventsByBatchQuerySchema,
  getEventsByBatchResponseSchema,
  batchSummaryResponseSchema,
} from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function batchRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /events/batch — batch insert with optional batchId
  typedApp.post(
    '/batch',
    {
      schema: {
        tags: ['Batch Operations'],
        description: 'Batch create event log entries with optional batchId and per-item error reporting',
        body: batchCreateEventRequestSchema,
        response: { 201: batchCreateEventResponseSchema },
      },
    },
    async (request, reply) => {
      const { events, batchId } = request.body;
      const { executionIds, correlationIds, errors } =
        await eventLogService.createEvents(events, batchId);

      return reply.status(201).send({
        success: errors.length === 0,
        totalReceived: events.length,
        totalInserted: executionIds.length,
        executionIds,
        correlationIds,
        ...(batchId ? { batchId } : {}),
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
