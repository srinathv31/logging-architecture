import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

/**
 * Builds a test app with health routes inline (mirrors src/routes/health.ts)
 * to avoid importing app.ts which loads env/db config.
 */
function buildTestApp(mockGetDb?: () => Promise<unknown>) {
  const app = Fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const livenessResponse = { status: "ok" as const };

  const pkg = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf-8"),
  );
  const versionResponse = { version: pkg.version as string };

  app.register(async (instance) => {
    const typedApp = instance.withTypeProvider<ZodTypeProvider>();

    typedApp.get(
      "/healthcheck",
      {
        schema: {
          tags: ["Health"],
          description: "Returns API health status",
          response: {
            200: z.object({ status: z.literal("ok") }),
          },
        },
      },
      async () => livenessResponse,
    );

    typedApp.get(
      "/healthcheck/ready",
      {
        schema: {
          tags: ["Health"],
          description: "Returns DB readiness status",
          response: {
            200: z.object({
              status: z.literal("ready"),
              database: z.literal("connected"),
              timestamp: z.string(),
            }),
            503: z.object({
              status: z.literal("not_ready"),
              database: z.literal("error"),
              error: z.string(),
              timestamp: z.string(),
            }),
          },
        },
      },
      async (_request, reply) => {
        try {
          const db = await mockGetDb!();
          await Promise.race([
            (db as { execute: (q: unknown) => Promise<unknown> }).execute(
              sql`SELECT 1`,
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Database health check timed out")),
                3000,
              ),
            ),
          ]);
          return {
            status: "ready" as const,
            database: "connected" as const,
            timestamp: new Date().toISOString(),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return reply.status(503).send({
            status: "not_ready" as const,
            database: "error" as const,
            error: message,
            timestamp: new Date().toISOString(),
          });
        }
      },
    );

    typedApp.get(
      "/version",
      {
        schema: {
          tags: ["Health"],
          description: "Returns API version from package.json",
          response: {
            200: z.object({ version: z.string() }),
          },
        },
      },
      async () => versionResponse,
    );
  }, { prefix: "/v1" });

  return app;
}

describe("GET /v1/healthcheck", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return status ok with 200", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/healthcheck",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("should have correct content-type header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/healthcheck",
    });

    expect(response.headers["content-type"]).toContain("application/json");
  });
});

describe("GET /v1/healthcheck/ready", () => {
  describe("when database is connected", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      const mockGetDb = vi.fn().mockResolvedValue({
        execute: vi.fn().mockResolvedValue(undefined),
      });
      app = buildTestApp(mockGetDb);
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it("should return 200 with ready status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/healthcheck/ready",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("ready");
      expect(body.database).toBe("connected");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("when database connection fails", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      const mockGetDb = vi
        .fn()
        .mockRejectedValue(new Error("Connection refused"));
      app = buildTestApp(mockGetDb);
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it("should return 503 with not_ready status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/healthcheck/ready",
      });

      expect(response.statusCode).toBe(503);
      const body = response.json();
      expect(body.status).toBe("not_ready");
      expect(body.database).toBe("error");
      expect(body.error).toBe("Connection refused");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("when database query times out", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      const mockGetDb = vi.fn().mockResolvedValue({
        execute: vi
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 10000)),
          ),
      });
      app = buildTestApp(mockGetDb);
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it("should return 503 with timeout error", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/healthcheck/ready",
      });

      expect(response.statusCode).toBe(503);
      const body = response.json();
      expect(body.status).toBe("not_ready");
      expect(body.database).toBe("error");
      expect(body.error).toBe("Database health check timed out");
    });
  }, 10000);
});

describe("GET /v1/version", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return version from package.json with 200", async () => {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf-8"),
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/version",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ version: pkg.version });
  });
});
