---
title: Error Handling
---

# Error Handling

## EventLogError

All API errors throw `EventLogError` with status code, error code, and message:

```typescript
import { EventLogError } from '@yourcompany/eventlog-sdk';

try {
  await client.createEvent(event);
} catch (error) {
  if (error instanceof EventLogError) {
    console.error('Status:', error.statusCode);
    console.error('Code:', error.errorCode);
    console.error('Message:', error.message);
  }
  throw error;
}
```

## Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation Error | Invalid request body (Zod validation failed) |
| 409 | Conflict | Duplicate unique constraint (e.g., idempotency key) |
| 429 | Rate Limited | Too many requests — SDK retries automatically |
| 500 | Internal Error | Server error — SDK retries automatically |

## Retry Behavior

The `EventLogClient` automatically retries on:

- **5xx** server errors
- **429** rate limit responses

Retries use exponential backoff up to `maxRetries` attempts. The `AsyncEventLogger` adds additional retry and circuit breaker logic on top of the client.

## AsyncEventLogger Error Callbacks

```typescript
const eventLog = new AsyncEventLogger({
  client,
  onEventFailed: (event, error) => {
    // Called when an event permanently fails (all retries exhausted)
    console.error('Permanently failed:', event.correlation_id, error);
  },
  onSpillover: (event) => {
    // Called when queue is full or circuit breaker is open
    // Persist the event for later replay
  },
});
```
