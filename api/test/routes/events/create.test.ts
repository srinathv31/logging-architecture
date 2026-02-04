import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createEventFixture } from '../../fixtures/events';
import {
  createEventRequestSchema,
  batchCreateEventRequestSchema,
  createEventResponseSchema,
  batchCreateEventResponseSchema,
} from '../../../src/schemas/events';

// Mock functions that will be configured per test
let mockCreateEvent: (event: unknown) => Promise<{ executionId: string; correlationId: string }>;
let mockCreateEvents: (events: unknown[]) => Promise<{ executionIds: string[]; errors: Array<{ index: number; error: string }> }>;

/**
 * Creates a test app with mocked service handlers
 */
function buildTestApp() {
  const app = Fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  // Register the events routes with mock handlers
  app.register(async (fastify) => {
    const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

    typedApp.post(
      '/events',
      {
        schema: {
          tags: ['Events'],
          description: 'Create one or more event log entries',
          body: createEventRequestSchema,
          response: { 201: createEventResponseSchema },
        },
      },
      async (request, reply) => {
        const { events } = request.body;

        if (Array.isArray(events)) {
          const results = await Promise.all(events.map((e) => mockCreateEvent(e)));
          const correlationId = events[0].correlation_id;
          return reply.status(201).send({
            success: true,
            execution_ids: results.map((r) => r.executionId),
            correlation_id: correlationId,
          });
        }

        const result = await mockCreateEvent(events);
        return reply.status(201).send({
          success: true,
          execution_ids: [result.executionId],
          correlation_id: events.correlation_id,
        });
      }
    );

    typedApp.post(
      '/events/batch',
      {
        schema: {
          tags: ['Events'],
          description: 'Batch create event log entries with per-item error reporting',
          body: batchCreateEventRequestSchema,
          response: { 201: batchCreateEventResponseSchema },
        },
      },
      async (request, reply) => {
        const { events } = request.body;
        const { executionIds, errors } = await mockCreateEvents(events);

        return reply.status(201).send({
          success: errors.length === 0,
          total_received: events.length,
          total_inserted: executionIds.length,
          execution_ids: executionIds,
          errors: errors.length > 0 ? errors : undefined,
        });
      }
    );
  }, { prefix: '/v1' });

  return app;
}

describe('POST /v1/events', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset mocks
    mockCreateEvent = async () => ({ executionId: 'default-id', correlationId: 'default-correlation' });
    mockCreateEvents = async () => ({ executionIds: [], errors: [] });
  });

  describe('single event creation', () => {
    it('should create a single event successfully', async () => {
      const eventFixture = createEventFixture();
      mockCreateEvent = async () => ({
        executionId: 'test-execution-id',
        correlationId: eventFixture.correlation_id,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events: eventFixture },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        success: true,
        execution_ids: ['test-execution-id'],
        correlation_id: eventFixture.correlation_id,
      });
    });

    it('should return 400 for invalid event payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events: { invalid: 'payload' } },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require correlation_id', async () => {
      const invalidEvent = { ...createEventFixture() };
      delete (invalidEvent as unknown as { correlation_id?: string }).correlation_id;

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events: invalidEvent },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require trace_id', async () => {
      const invalidEvent = { ...createEventFixture() };
      delete (invalidEvent as unknown as { trace_id?: string }).trace_id;

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events: invalidEvent },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('array event creation', () => {
    it('should create multiple events in an array', async () => {
      const events = [
        createEventFixture({ step_sequence: 1 }),
        createEventFixture({ step_sequence: 2 }),
      ];

      let callCount = 0;
      mockCreateEvent = async () => {
        callCount++;
        return {
          executionId: `exec-${callCount}`,
          correlationId: events[0].correlation_id,
        };
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        success: true,
        execution_ids: ['exec-1', 'exec-2'],
        correlation_id: events[0].correlation_id,
      });
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      const eventFixture = createEventFixture();
      mockCreateEvent = async () => {
        throw new Error('Database error');
      };

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events: eventFixture },
      });

      expect(response.statusCode).toBe(500);
    });
  });
});

describe('POST /v1/events/batch', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockCreateEvent = async () => ({ executionId: 'default-id', correlationId: 'default-correlation' });
    mockCreateEvents = async () => ({ executionIds: [], errors: [] });
  });

  it('should batch create events successfully', async () => {
    const events = [
      createEventFixture({ correlation_id: 'batch-1' }),
      createEventFixture({ correlation_id: 'batch-2' }),
    ];

    mockCreateEvents = async () => ({
      executionIds: ['exec-1', 'exec-2'],
      errors: [],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      payload: { events },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      success: true,
      total_received: 2,
      total_inserted: 2,
      execution_ids: ['exec-1', 'exec-2'],
    });
  });

  it('should report partial failures', async () => {
    const events = [
      createEventFixture({ correlation_id: 'batch-1' }),
      createEventFixture({ correlation_id: 'batch-2' }),
    ];

    mockCreateEvents = async () => ({
      executionIds: ['exec-1'],
      errors: [{ index: 1, error: 'Duplicate key error' }],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      payload: { events },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.total_received).toBe(2);
    expect(body.total_inserted).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toEqual({ index: 1, error: 'Duplicate key error' });
  });

  it('should require events array', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/events/batch',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});
