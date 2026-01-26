import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "./config/env";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerRoutes } from "./routes/index";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Event Log API",
        description:
          "REST API for ingesting, querying, and managing event logs across distributed systems.",
        version: "1.4.0",
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: "Local development",
        },
      ],
      tags: [
        { name: "Events", description: "Create and query event log entries" },
        { name: "Processes", description: "Manage process definitions" },
        {
          name: "Correlation Links",
          description: "Manage correlation-to-account mappings",
        },
        { name: "Batch Operations", description: "Batch upload, query, and summary endpoints (v1.4)" },
        { name: "Health", description: "Health check endpoint" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  app.register(swaggerUI, {
    routePrefix: "/docs",
  });

  app.register(cors, { origin: true });
  app.register(sensible);

  registerErrorHandler(app);

  app.get(
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
    async () => ({ status: "ok" as const }),
  );

  app.register(registerRoutes, { prefix: "/api/v1" });

  return app;
}
