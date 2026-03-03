---
title: MSSQL Constraint Violation Handling
impact: MEDIUM
impactDescription: maps database constraint violations to meaningful HTTP responses
tags: error, mssql, constraint, unique, conflict
---

## MSSQL Constraint Violation Handling

MSSQL error numbers 2627 (unique key violation) and 2601 (unique index violation) map to 409 Conflict.

**Incorrect (letting MSSQL errors bubble as 500):**

```typescript
// No special handling — MSSQL constraint errors surface as 500 Internal Server Error
app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return reply.status(500).send({ error: 'Internal Server Error' });
});
```

**Correct (mapping constraint violations to 409):**

```typescript
// In the error handler
if ('number' in error && ((error as { number?: number }).number === 2627 || (error as { number?: number }).number === 2601)) {
  return reply.status(409).send({
    error: 'Conflict',
    message: 'A resource with the given unique constraint already exists.',
  });
}
```

- Error 2627: Violation of PRIMARY KEY / UNIQUE KEY constraint
- Error 2601: Cannot insert duplicate key row with unique index
- Both indicate the client tried to create a resource that already exists
