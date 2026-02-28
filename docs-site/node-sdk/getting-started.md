---
title: Getting Started
---

# Getting Started

## Quick Start (Recommended: Real-Time Async Logging)

**Important:** Log events immediately after each step completes, not in batches at the end. This ensures events are captured even if your process crashes mid-way.

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
import * as fs from 'fs';

// === SETUP (once at application startup) ===

// 1. Configure OAuth authentication
const tokenProvider = new OAuthTokenProvider({
  tokenUrl: 'https://auth.yourcompany.com/oauth/token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scope: 'eventlog:write eventlog:read',  // optional
});

// 2. Create client with OAuth
const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  tokenProvider,
});

// 3. Create async logger (fire-and-forget)
const eventLog = new AsyncEventLogger({
  client,
  queueCapacity: 10_000,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  onSpillover: (event) => {
    fs.appendFileSync('/var/log/eventlog-spillover.json', JSON.stringify(event) + '\n');
  },
});

// === IN YOUR BUSINESS LOGIC ===

const correlationId = createCorrelationId('auth');
const traceId = createTraceId();

// Step 1: Do work, then log immediately
const result = await doIdentityVerification();
eventLog.log(createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  process_name: 'MY_PROCESS',
  step_sequence: 1,
  step_name: 'Identity Check',
  event_status: result.success ? EventStatus.SUCCESS : EventStatus.FAILURE,
  summary: `Identity verified - ${result.message}`,
  // ... other fields
}));
// Returns immediately - never blocks your business logic

// Step 2: Do more work, log immediately
const creditResult = await doCreditCheck();
eventLog.log(createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  process_name: 'MY_PROCESS',
  step_sequence: 2,
  step_name: 'Credit Check',
  event_status: creditResult.approved ? EventStatus.SUCCESS : EventStatus.FAILURE,
  summary: `Credit check - FICO ${creditResult.score}`,
}));

// Metrics
console.log(eventLog.getMetrics());
// { eventsQueued: 2, eventsSent: 2, eventsFailed: 0, ... }
```

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

## Simple Client Setup

For quick testing with an API key:

```typescript
import {
  EventLogClient,
  createCorrelationId,
  createTraceId,
  createProcessStartEvent,
  EventStatus,
} from '@yourcompany/eventlog-sdk';

const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  apiKey: 'your-api-key',
});

const correlationId = createCorrelationId('auth');
const traceId = createTraceId();

const startEvent = createProcessStartEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  application_id: 'auth-user-service',
  target_system: 'SELF',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  summary: 'Initiated Add Authorized User request',
  result: 'INITIATED',
  identifiers: {
    auth_user_ssn_last4: '5678',
  },
});

const response = await client.createEvent(startEvent);
console.log('Created:', response.execution_ids);
```

## Next Steps

- [AsyncEventLogger](/node-sdk/core/async-event-logger) — fire-and-forget logging
- [Event Builders](/node-sdk/core/event-builders) — helper functions
- [Complete Flow Example](/node-sdk/core/event-log-client) — full process example
