---
title: Centralized Error Handler Plugin
impact: HIGH
impactDescription: ensures all errors are handled consistently across all routes
tags: error, handler, plugin, fastify, zod
---

## Centralized Error Handler Plugin

Single centralized error handler registered as a Fastify plugin. Handles Zod, AppError, Fastify validation, and MSSQL errors.

**Incorrect (try/catch in every route):**

```typescript
app.get('/events', async (request, reply) => {
  try {
    const events = await eventLogService.getEvents();
    return reply.send(events);
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: error.errors });
    }
    // Duplicated in every route, inconsistent shapes
    return reply.status(500).send({ error: 'Something went wrong' });
  }
});
```

**Correct (centralized error handler plugin):**

```typescript
import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation Error', details: error.errors });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.code ?? error.name, message: error.message });
    }
    if ('validation' in error && error.validation) {
      return reply.status(400).send({ error: 'Validation Error', details: error.validation });
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      const statusCode = error.statusCode;
      if (statusCode >= 400 && statusCode < 600) {
        return reply.status(statusCode).send({ error: error.name, message: error.message });
      }
    }
    // MSSQL unique constraint violation
    if ('number' in error && (error.number === 2627 || error.number === 2601)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Resource with given unique constraint already exists.' });
    }
    app.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error', message: 'An unexpected error occurred.' });
  });
}
```

Registered in app.ts: `registerErrorHandler(app);`
