import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

const livenessResponse = { status: "ok" as const };

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf-8"),
);
const versionResponse = { version: pkg.version as string };

export async function healthRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/healthcheck",
    {
      schema: {
        tags: ["Health"],
        description: "Returns API health status",
        response: {
          200: z.object({
            status: z.literal("ok"),
          }),
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
        const db = await getDb();
        await Promise.race([
          db.execute(sql`SELECT 1`),
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
          200: z.object({
            version: z.string(),
          }),
        },
      },
    },
    async () => versionResponse,
  );
}
