import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { createEventFixture } from "../../fixtures/events";
import {
  eventLogEntrySchema,
  createEventResponseSchema,
} from "../../../src/schemas/events";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// Mock function that will be configured per test
let mockCreateEvent: (
  event: unknown,
) => Promise<{ executionId: string; correlationId: string }>;

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
  app.register(
    async (fastify) => {
      const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

      typedApp.post(
        "/events",
        {
          schema: {
            tags: ["Events"],
            description: "Create a single event log entry",
            body: eventLogEntrySchema,
            response: { 201: createEventResponseSchema },
          },
        },
        async (request, reply) => {
          const event = request.body;
          const result = await mockCreateEvent(event);
          return reply.status(201).send({
            success: true,
            executionIds: [result.executionId],
            correlationId: event.correlationId,
          });
        },
      );
    },
    { prefix: "/v1" },
  );

  return app;
}

describe("POST /v1/events", () => {
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
    mockCreateEvent = async () => ({
      executionId: "default-id",
      correlationId: "default-correlation",
    });
  });

  describe("single event creation", () => {
    it("should create a single event successfully", async () => {
      const eventFixture = createEventFixture();
      mockCreateEvent = async () => ({
        executionId: "test-execution-id",
        correlationId: eventFixture.correlationId,
      });

      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: eventFixture,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        success: true,
        executionIds: ["test-execution-id"],
        correlationId: eventFixture.correlationId,
      });
    });

    it("should return 400 for invalid event payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: { invalid: "payload" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should require correlationId", async () => {
      const invalidEvent = { ...createEventFixture() };
      delete (invalidEvent as unknown as { correlationId?: string })
        .correlationId;

      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: invalidEvent,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should require traceId", async () => {
      const invalidEvent = { ...createEventFixture() };
      delete (invalidEvent as unknown as { traceId?: string }).traceId;

      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: invalidEvent,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject non-hex traceId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: createEventFixture({ traceId: "not-a-valid-hex-trace-id!!" }),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject non-hex spanId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: createEventFixture({ spanId: "not-hex-span-id" }),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("error handling", () => {
    it("should handle service errors gracefully", async () => {
      const eventFixture = createEventFixture();
      mockCreateEvent = async () => {
        throw new Error("Database error");
      };

      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        payload: eventFixture,
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
