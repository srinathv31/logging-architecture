---
title: AsyncEventLogger
---

# AsyncEventLogger

The recommended way to log events. `AsyncEventLogger` provides fire-and-forget logging with automatic retry, circuit breaker, and spillover callbacks.

## Features

| Feature | Description |
|---------|-------------|
| **Fire-and-forget** | `log()` returns immediately, never blocks |
| **Automatic retry** | Failed events retry with exponential backoff |
| **Circuit breaker** | Stops hammering API when it's down |
| **Graceful shutdown** | Flushes pending events on process exit |
| **Spillover callback** | Custom handler when queue full or API down |

## Creating an Instance

```typescript
const eventLog = new AsyncEventLogger({
  client,
  queueCapacity: 10_000,           // Buffer size
  maxRetries: 3,                    // Retry attempts
  baseRetryDelayMs: 1000,          // Initial retry delay
  maxRetryDelayMs: 30_000,         // Max retry delay
  circuitBreakerThreshold: 5,       // Failures before circuit opens
  circuitBreakerResetMs: 30_000,    // Time before circuit resets

  // Called when event permanently fails
  onEventFailed: (event, error) => {
    console.error('Event failed:', event.correlation_id, error);
  },

  // Called for spillover (implement your own persistence)
  onSpillover: (event) => {
    // Write to disk, send to dead letter queue, etc.
  },
});
```

## Usage

```typescript
const correlationId = createCorrelationId('auth');
const traceId = createTraceId();

// Log a step event (returns immediately)
eventLog.log(createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  process_name: 'MY_PROCESS',
  step_sequence: 1,
  step_name: 'Identity Check',
  event_status: EventStatus.SUCCESS,
  summary: 'Identity verified',
}));

// Check metrics
console.log(eventLog.getMetrics());
// { eventsQueued: 1, eventsSent: 1, eventsFailed: 0, ... }
```

## Spillover Handling

Unlike the Java SDK which has built-in disk spillover, the Node SDK uses a callback-based approach. Implement the `onSpillover` callback to persist events however you prefer:

```typescript
import * as fs from 'fs';

const eventLog = new AsyncEventLogger({
  client,
  onSpillover: (event) => {
    fs.appendFileSync(
      '/var/log/eventlog-spillover.json',
      JSON.stringify(event) + '\n'
    );
  },
});
```
