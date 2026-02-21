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
        version: "1.5.0",
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: "Local development",
        },
      ],
      tags: [
        { name: "Events", description: "Create and query event log entries" },
        { name: "Traces", description: "Query traces grouped by trace ID" },
        { name: "Dashboard", description: "Aggregate statistics for dashboard views" },
        { name: "Processes", description: "Manage process definitions" },
        {
          name: "Correlation Links",
          description: "Manage correlation-to-account mappings",
        },
        {
          name: "Batch Operations",
          description: "Batch upload, query, and summary endpoints (v1.4)",
        },
        {
          name: "Lookup",
          description: "Fast structured event lookup for dashboard and agent workflows",
        },
        { name: "Health", description: "Health and version endpoints" },
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

  app.register(registerRoutes, { prefix: "/v1" });

  return app;
}
