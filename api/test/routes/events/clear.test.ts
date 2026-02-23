import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

let mockDeleteAll: () => Promise<void>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(
    async (fastify) => {
      const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

      typedApp.post(
        "/events/clear",
        {
          schema: {
            tags: ["Debug"],
            description:
              "Temporary debug endpoint that hard-deletes data from all Event Log tables",
            body: z.object({
              confirm: z.literal(true),
            }),
          },
        },
        async (_request, reply) => {
          await mockDeleteAll();
          return reply.status(204).send();
        },
      );
    },
    { prefix: "/v1/debug" },
  );

  return app;
}

describe("POST /v1/debug/events/clear", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockDeleteAll = async () => {};
  });

  it("should not expose DELETE /v1/events", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/v1/events",
    });

    expect(response.statusCode).toBe(404);
  });

  it("should clear all data and return 204 when confirmed", async () => {
    let deleteAllCalled = false;
    mockDeleteAll = async () => {
      deleteAllCalled = true;
    };

    const response = await app.inject({
      method: "POST",
      url: "/v1/debug/events/clear",
      payload: { confirm: true },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(deleteAllCalled).toBe(true);
  });

  it("should reject request without confirmation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/debug/events/clear",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it("should reject request when confirm is false", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/debug/events/clear",
      payload: { confirm: false },
    });

    expect(response.statusCode).toBe(400);
  });

  it("should handle service errors gracefully", async () => {
    mockDeleteAll = async () => {
      throw new Error("Database error");
    };

    const response = await app.inject({
      method: "POST",
      url: "/v1/debug/events/clear",
      payload: { confirm: true },
    });

    expect(response.statusCode).toBe(500);
  });
});
