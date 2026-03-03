---
title: AppError Class Hierarchy
impact: HIGH
impactDescription: provides consistent error handling with appropriate HTTP status codes
tags: error, class, hierarchy, http-status
---

## AppError Class Hierarchy

Base AppError class with statusCode and code. Subclasses for common HTTP errors.

**Incorrect (plain Error or inline status codes):**

```typescript
// In a service — coupling service to HTTP concerns
export async function getEvent(id: string) {
  const event = await db.select().from(eventLogs).where(eq(eventLogs.id, id));
  if (!event) {
    throw new Error('Not found'); // No status code, will become 500
  }
  return event;
}

// In a route — inconsistent error shapes
app.get('/events/:id', async (request, reply) => {
  const event = await getEvent(id);
  if (!event) {
    return reply.status(404).send({ msg: 'not found' }); // Ad-hoc shape
  }
});
```

**Correct (AppError hierarchy):**

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}
```

Throw from services: `throw new NotFoundError('Account not found')`. The error handler plugin maps these to proper HTTP responses.
