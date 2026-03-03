---
title: Route Definition with Zod Type Provider
impact: CRITICAL
impactDescription: Routes without type provider lose compile-time safety between schema and handler, causing runtime type mismatches
tags: fastify, routes, zod, type-provider
---

## Route Definition with Zod Type Provider

Every route must use the Zod type provider to ensure request and response types are inferred directly from Zod schemas. Export an async function that takes `FastifyInstance`, call `.withTypeProvider<ZodTypeProvider>()`, and register the HTTP method with a `schema` object containing `tags`, `description`, `body`/`querystring`, and `response`.

**Incorrect (no type provider, inline validation, missing schema object):**

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function createEventRoutes(app: FastifyInstance) {
  // No type provider - request.body is 'unknown'
  app.post('/', async (request, reply) => {
    // Manual validation in the handler - error-prone, no type inference
    const parsed = z.object({
      correlationId: z.string(),
      eventType: z.string(),
    }).parse(request.body);

    const result = await eventLogService.createEvent(parsed);
    return reply.send({ success: true });
  });
}
```

**Correct (type provider with full schema registration):**

```typescript
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eventLogEntrySchema, createEventResponseSchema } from '../../schemas/events';
import * as eventLogService from '../../services/event-log.service';

export async function createEventRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post('/', {
    schema: {
      tags: ['Events'],
      description: 'Create a single event log entry',
      body: eventLogEntrySchema,
      response: { 201: createEventResponseSchema },
    },
  }, async (request, reply) => {
    const event = request.body;
    const result = await eventLogService.createEvent(event);
    return reply.status(201).send({
      success: true,
      executionIds: [result.executionId],
      correlationId: event.correlationId,
    });
  });
}
```

With the type provider in place, `request.body` is fully typed from `eventLogEntrySchema` -- no manual parsing or type assertions needed. The `schema.response` object also validates outgoing data and generates accurate Swagger documentation via `@fastify/swagger`.
