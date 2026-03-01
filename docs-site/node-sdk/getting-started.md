---
title: Getting Started
---

# Getting Started

## Quick Start (Recommended: EventLogTemplate)

The `EventLogTemplate` + `ProcessLogger` API is the recommended way to log events. It eliminates boilerplate by reusing shared defaults across process steps. If you're coming from the Java SDK, this is the same `EventLogTemplate` — but with idiomatic TypeScript options objects instead of chainable builders.

**Important:** Log events immediately after each step completes, not in batches at the end. This ensures events are captured even if your process crashes mid-way.

```typescript
import {
  EventLogClient,
  AsyncEventLogger,
  EventLogTemplate,
  OAuthTokenProvider,
  EventStatus,
} from '@yourcompany/eventlog-sdk';

// === SETUP (once at application startup) ===

// 1. Configure OAuth authentication
const tokenProvider = new OAuthTokenProvider({
  tokenUrl: 'https://auth.yourcompany.com/oauth/token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scope: 'eventlog:write eventlog:read',
});

// 2. Create client with OAuth
const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  tokenProvider,
});

// 3. Create async logger (fire-and-forget)
const asyncLogger = new AsyncEventLogger({
  client,
  queueCapacity: 10_000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
});

// 4. Create template with shared defaults
const template = new EventLogTemplate({
  logger: asyncLogger,
  applicationId: 'auth-user-service',
  targetSystem: 'EXPERIAN',
  originatingSystem: 'MOBILE_APP',
});

// === IN YOUR BUSINESS LOGIC ===

async function onboardUser(userId: string) {
  // Create a process logger — IDs auto-generated
  const process = template.forProcess('ADD_AUTH_USER', {
    identifiers: { auth_user_id: userId },
  });

  // Process start
  process.logStart('Auth user onboarding initiated');

  // Step 1: Do work, then log immediately
  const result = await doIdentityVerification();
  process.logStep(1, 'Identity Check',
    result.success ? EventStatus.SUCCESS : EventStatus.FAILURE,
    `Identity verified - ${result.message}`, {
      executionTimeMs: result.durationMs,
      requestPayload: result.request,
      responsePayload: result.response,
    });
  // Returns immediately — never blocks your business logic
  // One-shot fields only apply to this call (no state to clear)

  // Step 2: Do more work, log immediately
  const creditResult = await doCreditCheck();
  process.logStep(2, 'Credit Check',
    creditResult.approved ? EventStatus.SUCCESS : EventStatus.FAILURE,
    `Credit check - FICO ${creditResult.score}`, {
      executionTimeMs: creditResult.durationMs,
    });

  // Process end with total duration
  process.logEnd(3, EventStatus.SUCCESS, 'Auth user added', 3200);
}
```

::: tip Coming from the Java SDK?
The concepts are identical — `EventLogTemplate`, `ProcessLogger`, persistent fields, one-shot fields. The difference is API style: Java uses chainable `.with*()` calls that auto-clear; Node uses an `options` object on each method. See the [full comparison](/node-sdk/core/event-log-template#api-style-java-vs-node).
:::

### Why Real-Time Logging?

```
Bad - Batch at end:                Good - Log per step:
   Step 1 completed (in memory)      Step 1 completed -> sent
   Step 2 completed (in memory)      Step 2 completed -> sent
   Step 3 CRASH                      Step 3 CRASH
   ─────────────────                 ─────────────────
   Events sent: 0                    Events sent: 2
   Events lost: 2                    Events lost: 0
```

## Low-Level API (Event Builders)

For cases where you don't need a template, you can build events directly with helper functions:

```typescript
import {
  EventLogClient,
  AsyncEventLogger,
  OAuthTokenProvider,
  EventStatus,
  createCorrelationId,
  createTraceId,
  createStepEvent,
} from '@yourcompany/eventlog-sdk';

const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  tokenProvider,
});

const eventLog = new AsyncEventLogger({ client });

const correlationId = createCorrelationId('auth');
const traceId = createTraceId();

eventLog.log(createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  application_id: 'auth-user-service',
  target_system: 'SELF',
  originating_system: 'MOBILE_APP',
  process_name: 'MY_PROCESS',
  step_sequence: 1,
  step_name: 'Identity Check',
  event_status: EventStatus.SUCCESS,
  summary: 'Identity verified',
  result: 'OK',
}));
```

## Next Steps

- [EventLogTemplate](/node-sdk/core/event-log-template) — scoped process logging (primary API)
- [Context Propagation](/node-sdk/core/context) — automatic ID propagation with AsyncLocalStorage
- [AsyncEventLogger](/node-sdk/core/async-event-logger) — fire-and-forget logging internals
- [Event Builders](/node-sdk/core/event-builders) — low-level helper functions
- [Complete Flow Example](/node-sdk/core/event-log-client) — synchronous client example
