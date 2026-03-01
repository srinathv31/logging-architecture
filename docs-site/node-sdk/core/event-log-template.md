---
title: EventLogTemplate
---

# EventLogTemplate

The primary API for logging events. `EventLogTemplate` stores shared defaults and spawns `ProcessLogger` instances, eliminating the need to repeat 10+ fields on every event.

## Setup

```typescript
import {
  EventLogClient,
  AsyncEventLogger,
  EventLogTemplate,
  OAuthTokenProvider,
} from '@yourcompany/eventlog-sdk';

const tokenProvider = new OAuthTokenProvider({
  tokenUrl: 'https://auth.yourcompany.com/oauth/token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
});

const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  tokenProvider,
});

const asyncLogger = new AsyncEventLogger({ client });

const template = new EventLogTemplate({
  logger: asyncLogger,
  applicationId: 'account-origination',
  targetSystem: 'core-banking',
  originatingSystem: 'origination-service',
});
```

## ProcessLogger

`ProcessLogger` is the primary API for logging multi-step processes:

```typescript
import { EventStatus } from '@yourcompany/eventlog-sdk';

async function processOrder(order: Order) {
  // IDs auto-generated or read from AsyncLocalStorage context
  const process = template.forProcess('ORDER_PROCESSING', {
    identifiers: { orderId: order.id },
  });

  process.logStart('Order processing initiated');

  // Add data as you learn it — stacks forward to subsequent events
  const reservationId = await reserveInventory(order);
  process.addIdentifier('reservationId', reservationId);

  process.logStep(1, 'Validate Order', EventStatus.SUCCESS, 'Order validated');
  process.logStep(2, 'Reserve Inventory', EventStatus.SUCCESS, 'Reserved');

  process.logEnd(3, EventStatus.SUCCESS, 'Order processed', 1500);
}
```

## API Style: Java vs Node

Both SDKs share the same concepts (EventLogTemplate, ProcessLogger, persistent vs one-shot fields), but use idiomatic patterns for their respective languages:

::: info Key Difference
**Java** uses a **chainable fluent builder** — one-shot fields are set via chained `.with*()` calls before the emit method, and auto-clear after each emit.

**Node** uses an **options object** — one-shot fields are passed as a final `options` parameter directly on each emit method. No state to clear.
:::

### Side-by-Side Comparison

**Creating a ProcessLogger:**

::: code-group

```java [Java]
ProcessLogger process = template.forProcess("ADD_AUTH_USER")
    .withCorrelationId(correlationId)
    .withTraceId(traceId)
    .addIdentifier("auth_user_id", userId);
```

```typescript [Node]
const process = template.forProcess('ADD_AUTH_USER', {
  correlationId,
  traceId,
  identifiers: { auth_user_id: userId },
});
```

:::

**Logging a step with HTTP details:**

::: code-group

```java [Java]
// One-shot fields set via chaining, then auto-clear after logStep()
process.withEndpoint("/api/v2/partners/verify")
    .withHttpMethod(HttpMethod.POST)
    .withHttpStatusCode(response.statusCode())
    .withRequestPayload(requestBody)
    .withResponsePayload(response.body())
    .withExecutionTimeMs((int) response.duration().toMillis())
    .logStep(1, "Partner Verify", EventStatus.SUCCESS,
        "Partner verified", "VERIFIED");
```

```typescript [Node]
// One-shot fields passed as options object — no state to clear
process.logStep(1, 'Partner Verify', EventStatus.SUCCESS, 'Partner verified', {
  endpoint: '/api/v2/partners/verify',
  httpMethod: 'POST',
  httpStatusCode: response.status,
  requestPayload: requestBody,
  responsePayload: response.data,
  executionTimeMs: elapsed,
  result: 'VERIFIED',
});
```

:::

**Ending a process:**

::: code-group

```java [Java]
process.processEnd(3, EventStatus.SUCCESS,
    "Auth user added", "COMPLETED", 3200);
```

```typescript [Node]
process.logEnd(3, EventStatus.SUCCESS,
    'Auth user added', 3200, { result: 'COMPLETED' });
```

:::

**Error logging:**

::: code-group

```java [Java]
process.error("E001", "Identity check failed",
    "User identity could not be verified", "FAILED");
```

```typescript [Node]
process.logError('User identity could not be verified',
    'E001', 'Identity check failed');
```

:::

### Quick Reference

| Concept | Java | Node |
|---------|------|------|
| One-shot fields | `.withEndpoint().withHttpMethod().logStep(...)` (chainable, auto-clears) | `logStep(..., { endpoint, httpMethod })` (options object) |
| Persistent mutators | `.addIdentifier("k", "v")` (chainable at construction) | `.addIdentifier("k", "v")` (method call anytime) |
| Process overrides | `.withApplicationId("x")` (at construction) | `.setApplicationId("x")` (method call anytime) |
| Context propagation | MDC (SLF4J) — automatic in Spring | AsyncLocalStorage — `eventLogContext.run()` |
| ID generation | Auto from MDC or `EventLogUtils.createCorrelationId()` | Auto from context or `createCorrelationId()` |

## Context Propagation

The Node SDK uses `AsyncLocalStorage` (Node's equivalent of Java's SLF4J MDC) to automatically propagate IDs:

```typescript
import { eventLogContext } from '@yourcompany/eventlog-sdk';

// In your middleware — set context once per request
app.use((req, res, next) => {
  eventLogContext.run(
    {
      correlationId: req.headers['x-correlation-id'] || createCorrelationId(),
      traceId: req.headers['x-trace-id'] || createTraceId(),
    },
    () => next()
  );
});

// In any downstream service — ProcessLogger reads from context automatically
const process = template.forProcess('ORDER_PROCESSING');
// process.correlationId is auto-populated from context
```

See [Context Propagation](/node-sdk/core/context) for full details.

## ProcessLogger API Reference

### Construction via `template.forProcess()`

```typescript
const process = template.forProcess('PROCESS_NAME', {
  accountId: 'acct-123',         // optional
  correlationId: 'corr-123',     // optional — auto-reads from context, then auto-generates
  traceId: 'trace-abc',          // optional — auto-reads from context, then auto-generates
  batchId: 'batch-456',          // optional
  identifiers: { key: 'value' }, // optional — initial identifiers
});
```

### Persistent Mutators

These are called after construction and apply to **all** subsequent events:

| Method | Description |
|--------|-------------|
| `addIdentifier(key, value)` | Add key-value identifier (stacks forward) |
| `addMetadata(key, value)` | Add key-value metadata (stacks forward) |
| `setApplicationId(id)` | Override template's applicationId |
| `setTargetSystem(system)` | Override template's targetSystem for all events |
| `setOriginatingSystem(system)` | Override template's originatingSystem |

### Emit Methods

| Method | Description |
|--------|-------------|
| `logStart(summary, options?)` | Emit a `PROCESS_START` event (stepSequence=0, status=IN_PROGRESS) |
| `logStep(seq, name, status, summary, options?)` | Emit a `STEP` event |
| `logEnd(seq, status, summary, executionTimeMs, options?)` | Emit a `PROCESS_END` event |
| `logError(summary, errorCode, errorMessage, options?)` | Emit an `ERROR` event (status=FAILURE) |

### EventOptions (One-Shot Fields)

Pass these as the `options` parameter on any emit method:

```typescript
interface EventOptions {
  spanId?: string;            // Override auto-generated span ID
  parentSpanId?: string;      // Set parent span ID
  spanLinks?: string[];       // Set span links (fork-join)
  executionTimeMs?: number;   // Execution time in milliseconds
  endpoint?: string;          // API endpoint URL
  httpMethod?: HttpMethod;    // HTTP method (GET, POST, etc.)
  httpStatusCode?: number;    // HTTP status code
  requestPayload?: string;    // Request payload (for audit)
  responsePayload?: string;   // Response payload (for audit)
  metadata?: Record<string, unknown>; // Per-event metadata
  errorCode?: string;         // Error code
  errorMessage?: string;      // Error message
  idempotencyKey?: string;    // Idempotency key
  targetSystem?: string;      // Per-event target system override
  result?: string;            // Custom result string
}
```

### Span Tracking

| Method | Description |
|--------|-------------|
| `getRootSpanId()` | Get the span ID from the first event logged (`logStart`) |
| `getLastStepSpanId()` | Get the span ID from the most recent `logStep` call |

### Read-Only Properties

| Property | Description |
|----------|-------------|
| `correlationId` | The resolved correlation ID |
| `traceId` | The resolved trace ID |

## Examples

### HTTP Logging with Request/Response Payloads

```typescript
const process = template.forProcess('PARTNER_API_CALL');

process.logStart('Calling partner verification API');

const response = await fetch('/api/v2/partners/verify', { method: 'POST', body });

process.logStep(1, 'Partner Verify', EventStatus.SUCCESS, 'Partner verified', {
  endpoint: '/api/v2/partners/verify',
  httpMethod: 'POST',
  httpStatusCode: response.status,
  requestPayload: body,
  responsePayload: await response.text(),
  executionTimeMs: elapsed,
  result: 'VERIFIED',
});

process.logEnd(2, EventStatus.SUCCESS, 'API call complete', totalMs, {
  result: 'DONE',
});
```

### Warning Steps with Error Context

```typescript
process.logStep(2, 'Call External API', EventStatus.WARNING,
  'Rate limited by partner, will retry', {
    errorCode: 'RATE_LIMIT',
    errorMessage: '429 Too Many Requests - retrying in 2s',
    result: 'RETRYING',
  });

// Next step — no state to clear, each call is independent
process.logStep(3, 'Retry API Call', EventStatus.SUCCESS,
  'Retry succeeded', { result: 'OK' });
```

### Progressive Identifier Discovery

```typescript
const process = template.forProcess('ONBOARD_USER', {
  identifiers: { request_id: 'req-123' },
});

process.logStart('User onboarding initiated');

// Step 1: Identity check — learn the user ID
const identity = await verifyIdentity(data);
process.addIdentifier('user_id', identity.userId);

process.logStep(1, 'Identity Check', EventStatus.SUCCESS,
  'Identity verified');
// Event includes: { request_id, user_id }

// Step 2: Account creation — learn the account number
const account = await createAccount(identity);
process.addIdentifier('account_number', account.number);

process.logStep(2, 'Create Account', EventStatus.SUCCESS,
  'Account created');
// Event includes: { request_id, user_id, account_number }

process.logEnd(3, EventStatus.SUCCESS, 'Onboarding complete', totalMs);
```

### Distributed Tracing with Span Links

```typescript
const process = template.forProcess('PARALLEL_CHECKS');

process.logStart('Starting parallel verification');

// Fork: parallel steps share the root span as parent
const rootSpanId = process.getRootSpanId()!;

const [idResult, creditResult] = await Promise.all([
  doIdentityCheck(),
  doCreditCheck(),
]);

process.logStep(1, 'Identity Check', EventStatus.SUCCESS,
  'Identity verified', { parentSpanId: rootSpanId });

const idSpan = process.getLastStepSpanId()!;

process.logStep(2, 'Credit Check', EventStatus.SUCCESS,
  'Credit passed', { parentSpanId: rootSpanId });

const creditSpan = process.getLastStepSpanId()!;

// Join: link the parallel spans
process.logEnd(3, EventStatus.SUCCESS, 'All checks passed', totalMs, {
  spanLinks: [idSpan, creditSpan],
});
```

## Important Notes

- `ProcessLogger` is **mutable** and request-scoped. Don't share across concurrent requests.
- Identifiers added via `addIdentifier()` stack forward to all subsequent events in the process.
- The template automatically resolves `applicationId`, `targetSystem`, and `originatingSystem` from configuration.
- If no `correlationId` or `traceId` is provided and no AsyncLocalStorage context is active, they are auto-generated.
