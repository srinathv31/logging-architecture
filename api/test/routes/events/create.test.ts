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
  createEventUnionResponseSchema,
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
          response: { 201: createEventUnionResponseSchema },
        },
      },
      async (request, reply) => {
        const { events } = request.body;

        if (Array.isArray(events)) {
          const { executionIds, errors } = await mockCreateEvents(events);
          const correlationIds = [...new Set(events.map((e: { correlationId: string }) => e.correlationId))];
          return reply.status(201).send({
            success: errors.length === 0,
            totalReceived: events.length,
            totalInserted: executionIds.length,
            executionIds: executionIds,
            correlationIds: correlationIds,
            errors: errors.length > 0 ? errors : undefined,
          });
        }

        const result = await mockCreateEvent(events);
        return reply.status(201).send({
          success: true,
          executionIds: [result.executionId],
          correlationId: events.correlationId,
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
          totalReceived: events.length,
          totalInserted: executionIds.length,
          executionIds: executionIds,
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
        correlationId: eventFixture.correlationId,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events: eventFixture },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        success: true,
        executionIds: ['test-execution-id'],
        correlationId: eventFixture.correlationId,
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

    it('should require correlationId', async () => {
      const invalidEvent = { ...createEventFixture() };
      delete (invalidEvent as unknown as { correlationId?: string }).correlationId;

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events: invalidEvent },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require traceId', async () => {
      const invalidEvent = { ...createEventFixture() };
      delete (invalidEvent as unknown as { traceId?: string }).traceId;

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
        createEventFixture({ stepSequence: 1 }),
        createEventFixture({ stepSequence: 2 }),
      ];

      mockCreateEvents = async () => ({
        executionIds: ['exec-1', 'exec-2'],
        errors: [],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.totalReceived).toBe(2);
      expect(body.totalInserted).toBe(2);
      expect(body.executionIds).toEqual(['exec-1', 'exec-2']);
      expect(body.correlationIds).toEqual([events[0].correlationId]);
    });

    it('should return multiple correlationIds when events have different ones', async () => {
      const events = [
        createEventFixture({ correlationId: 'corr-A' }),
        createEventFixture({ correlationId: 'corr-B' }),
        createEventFixture({ correlationId: 'corr-A' }),
      ];

      mockCreateEvents = async () => ({
        executionIds: ['exec-1', 'exec-2', 'exec-3'],
        errors: [],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.correlationIds).toEqual(['corr-A', 'corr-B']);
    });

    it('should report partial failures with errors array', async () => {
      const events = [
        createEventFixture({ stepSequence: 1 }),
        createEventFixture({ stepSequence: 2 }),
      ];

      mockCreateEvents = async () => ({
        executionIds: ['exec-1'],
        errors: [{ index: 1, error: 'Duplicate key' }],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/events',
        payload: { events },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.totalReceived).toBe(2);
      expect(body.totalInserted).toBe(1);
      expect(body.errors).toEqual([{ index: 1, error: 'Duplicate key' }]);
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
      createEventFixture({ correlationId: 'batch-1' }),
      createEventFixture({ correlationId: 'batch-2' }),
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
      totalReceived: 2,
      totalInserted: 2,
      executionIds: ['exec-1', 'exec-2'],
    });
  });

  it('should report partial failures', async () => {
    const events = [
      createEventFixture({ correlationId: 'batch-1' }),
      createEventFixture({ correlationId: 'batch-2' }),
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
    expect(body.totalReceived).toBe(2);
    expect(body.totalInserted).toBe(1);
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
