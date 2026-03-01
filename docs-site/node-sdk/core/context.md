---
title: Context Propagation
---

# Context Propagation

The Node SDK uses `AsyncLocalStorage` to automatically propagate correlation IDs, trace IDs, and other context through async call chains — the Node.js equivalent of Java's SLF4J MDC.

## How It Works

| | Java SDK | Node SDK |
|--|---------|----------|
| **Mechanism** | SLF4J MDC (ThreadLocal) | AsyncLocalStorage |
| **Setup** | Servlet filter sets MDC keys | Middleware calls `eventLogContext.run()` |
| **Reading** | `EventLogTemplate` reads MDC automatically | `ProcessLogger` reads context automatically |
| **Scope** | Per-thread | Per-async-chain (follows `await`, callbacks, timers) |

## Quick Start

```typescript
import {
  eventLogContext,
  createCorrelationId,
  createTraceId,
  EventLogTemplate,
} from '@yourcompany/eventlog-sdk';

// 1. Set context at request entry (middleware)
app.use((req, res, next) => {
  eventLogContext.run(
    {
      correlationId: req.headers['x-correlation-id'] as string || createCorrelationId(),
      traceId: req.headers['x-trace-id'] as string || createTraceId(),
    },
    () => next()
  );
});

// 2. Use ProcessLogger anywhere downstream — IDs auto-populate
async function handleOrder(order: Order) {
  const process = template.forProcess('ORDER_PROCESSING');

  // correlationId and traceId are automatically read from context
  console.log(process.correlationId); // "corr-abc123..."

  process.logStart('Order processing initiated');
  // ...
}
```

## API Reference

### `EventLogContext`

```typescript
import { EventLogContext, eventLogContext } from '@yourcompany/eventlog-sdk';
```

`eventLogContext` is a pre-created singleton. You can also create your own instances with `new EventLogContext()`.

#### `run(data, fn)`

Run a function within a context scope. Context is available to all sync and async code inside `fn`.

```typescript
eventLogContext.run(
  { correlationId: 'corr-123', traceId: 'trace-abc' },
  () => {
    // Context available here and in any async calls
    handleRequest();
  }
);
```

#### `get()`

Get the current context. Returns `undefined` outside of `run()`.

```typescript
const ctx = eventLogContext.get();
if (ctx) {
  console.log(ctx.correlationId);
}
```

#### `set(key, value)`

Update a value in the current context. No-op outside of `run()`.

```typescript
eventLogContext.set('spanId', newSpanId);
```

### `EventLogContextData`

```typescript
interface EventLogContextData {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  batchId?: string;
  accountId?: string;
}
```

## Priority Resolution

When creating a `ProcessLogger`, IDs are resolved in this order:

1. **Explicit config** — values passed to `forProcess()` options
2. **AsyncLocalStorage context** — values from `eventLogContext.run()`
3. **Auto-generated** — `createCorrelationId()` / `createTraceId()`

```typescript
// 1. Explicit config always wins
eventLogContext.run({ correlationId: 'from-context' }, () => {
  const process = template.forProcess('P', { correlationId: 'explicit' });
  process.correlationId; // "explicit"
});

// 2. Context is used when no explicit value
eventLogContext.run({ correlationId: 'from-context' }, () => {
  const process = template.forProcess('P');
  process.correlationId; // "from-context"
});

// 3. Auto-generated when neither is set
const process = template.forProcess('P');
process.correlationId; // "corr-a1b2c3..."
```

## Framework Examples

### Express

```typescript
import express from 'express';
import { eventLogContext, createCorrelationId, createTraceId } from '@yourcompany/eventlog-sdk';

const app = express();

app.use((req, res, next) => {
  eventLogContext.run(
    {
      correlationId: req.headers['x-correlation-id'] as string || createCorrelationId(),
      traceId: req.headers['x-trace-id'] as string || createTraceId(),
    },
    () => next()
  );
});
```

### Fastify

```typescript
import Fastify from 'fastify';
import { eventLogContext, createCorrelationId, createTraceId } from '@yourcompany/eventlog-sdk';

const app = Fastify();

app.addHook('onRequest', (request, reply, done) => {
  eventLogContext.run(
    {
      correlationId: request.headers['x-correlation-id'] as string || createCorrelationId(),
      traceId: request.headers['x-trace-id'] as string || createTraceId(),
    },
    () => done()
  );
});
```

### Nested Scopes

Context scopes can be nested. Inner scopes don't affect outer scopes:

```typescript
eventLogContext.run({ correlationId: 'outer' }, () => {
  console.log(eventLogContext.get()?.correlationId); // "outer"

  eventLogContext.run({ correlationId: 'inner' }, () => {
    console.log(eventLogContext.get()?.correlationId); // "inner"
  });

  console.log(eventLogContext.get()?.correlationId); // "outer"
});
```

## Comparison with Java MDC

| Java (MDC) | Node (AsyncLocalStorage) |
|-----------|--------------------------|
| `MDC.put("correlationId", id)` | `eventLogContext.run({ correlationId: id }, fn)` |
| `MDC.get("correlationId")` | `eventLogContext.get()?.correlationId` |
| `MDC.clear()` | Automatic — context ends when `run()` callback returns |
| Requires `MDC.clear()` to avoid leaks | No manual cleanup needed |
| Thread-local — lost in thread pools without propagation | Follows async chains automatically (`await`, `setTimeout`, etc.) |
| Set in Servlet filter | Set in Express/Fastify middleware |
