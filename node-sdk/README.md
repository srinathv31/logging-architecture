# Event Log SDK for TypeScript

TypeScript/JavaScript SDK for the Event Log API v1.4 - Centralized event logging for Credit Card Technology.

## Installation

```bash
npm install @yourcompany/eventlog-sdk
# or
yarn add @yourcompany/eventlog-sdk
```

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
// ⬆️ Returns immediately - never blocks your business logic

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
  // ... other fields
}));

// Metrics
console.log(eventLog.getMetrics());
// { eventsQueued: 2, eventsSent: 2, eventsFailed: 0, ... }
```

### Why Real-Time Logging?

```
❌ Batch at end (WRONG):           ✅ Log per step (CORRECT):
   Step 1 ✓ (in memory)               Step 1 ✓ → 📤 sent
   Step 2 ✓ (in memory)               Step 2 ✓ → 📤 sent
   Step 3 💥 CRASH                    Step 3 💥 CRASH
   ─────────────────                  ─────────────────
   Events sent: 0                     Events sent: 2
   Events lost: 2                     Events lost: 0
```

## AsyncEventLogger Features

| Feature | Description |
|---------|-------------|
| **Fire-and-forget** | `log()` returns immediately, never blocks |
| **Automatic retry** | Failed events retry with exponential backoff |
| **Circuit breaker** | Stops hammering API when it's down |
| **Graceful shutdown** | Flushes pending events on process exit |
| **Spillover callback** | Custom handler when queue full or API down |

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

## Synchronous Client (For Special Cases)

Use the synchronous `EventLogClient` only when you need confirmation that events were sent (rare).

```typescript
// Single event (waits for response)
const response = await client.createEvent(event);

// Batch (for bulk imports, migrations)
const batchResponse = await client.createEvents([event1, event2, event3]);
```

## Quick Start

```typescript
import {
  EventLogClient,
  createCorrelationId,
  createTraceId,
  createProcessStartEvent,
  createStepEvent,
  createProcessEndEvent,
  EventStatus,
} from '@yourcompany/eventlog-sdk';

// Create client
const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  apiKey: 'your-api-key',
});

// Generate IDs
const correlationId = createCorrelationId('auth');
const traceId = createTraceId();

// Create events using helper functions
const startEvent = createProcessStartEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  application_id: 'auth-user-service',
  target_system: 'SELF',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  summary: 'Initiated Add Authorized User request for account AC-1234567890',
  result: 'INITIATED',
  identifiers: {
    auth_user_ssn_last4: '5678',
    primary_cardholder_id: 'CH-98765',
  },
});

// Send the event
const response = await client.createEvent(startEvent);
console.log('Created:', response.execution_ids);
```

## Complete Flow Example

```typescript
import {
  EventLogClient,
  createCorrelationId,
  createTraceId,
  createSpanId,
  createProcessStartEvent,
  createStepEvent,
  createProcessEndEvent,
  EventStatus,
  HttpMethod,
  generateSummary,
  maskLast4,
} from '@yourcompany/eventlog-sdk';

const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  apiKey: 'your-api-key',
});

async function processAddAuthUser(accountId: string, authUserSsn: string) {
  const correlationId = createCorrelationId('auth');
  const traceId = createTraceId();
  const processName = 'ADD_AUTH_USER';
  const startTime = Date.now();

  const events = [];

  // 1. Process Start
  events.push(createProcessStartEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: createSpanId(),
    application_id: 'auth-user-service',
    target_system: 'SELF',
    originating_system: 'MOBILE_APP',
    process_name: processName,
    summary: generateSummary({
      action: 'Initiated Add Authorized User request',
      target: `for account ${accountId}`,
      outcome: `adding user with SSN ${maskLast4(authUserSsn)}`,
    }),
    result: 'INITIATED',
    identifiers: {
      auth_user_ssn_last4: authUserSsn.slice(-4),
    },
  }));

  // 2. Experian Validation Step
  const step1SpanId = createSpanId();
  events.push(createStepEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: step1SpanId,
    parent_span_id: events[0].span_id,
    application_id: 'auth-user-service',
    target_system: 'EXPERIAN',
    originating_system: 'MOBILE_APP',
    process_name: processName,
    step_sequence: 1,
    step_name: 'Validate auth user identity',
    event_status: EventStatus.SUCCESS,
    summary: generateSummary({
      action: 'Validated authorized user Jane Doe',
      target: `(SSN ${maskLast4(authUserSsn)})`,
      outcome: 'identity confirmed',
      details: 'fraud score 0.08',
    }),
    result: 'IDENTITY_VERIFIED',
    identifiers: {
      auth_user_id: 'AU-111222',
      experian_transaction_id: 'EXP-333444',
    },
    endpoint: '/v2/identity/verify',
    http_method: HttpMethod.POST,
    http_status_code: 200,
    execution_time_ms: 920,
  }));

  // 3. Process End
  events.push(createProcessEndEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: createSpanId(),
    parent_span_id: events[0].span_id,
    application_id: 'auth-user-service',
    target_system: 'SELF',
    originating_system: 'MOBILE_APP',
    process_name: processName,
    step_sequence: 5,
    event_status: EventStatus.SUCCESS,
    summary: generateSummary({
      action: 'Add Authorized User completed',
      target: `for account ${accountId}`,
      outcome: 'Jane Doe (AU-111222) added successfully',
    }),
    result: 'COMPLETED',
    identifiers: {
      auth_user_id: 'AU-111222',
    },
    execution_time_ms: Date.now() - startTime,
  }));

  // Send all events in batch
  return client.createEvents(events);
}
```

## Batch Processing

```typescript
import { createBatchId, createCorrelationId, createTraceId } from '@yourcompany/eventlog-sdk';

const batchId = createBatchId('hr-upload');

// Process each CSV row
const events = csvRows.map((row) => {
  const correlationId = createCorrelationId('emp');
  
  return createProcessStartEvent({
    correlation_id: correlationId,
    trace_id: createTraceId(),
    batch_id: batchId,  // Groups all rows together
    application_id: 'employee-origination-service',
    target_system: 'EMPLOYEE_ORIGINATION_SERVICE',
    originating_system: 'HR_PORTAL',
    process_name: 'EMPLOYEE_CARD_ORIGINATION',
    summary: `Employee card origination initiated for ${row.employeeId}`,
    result: 'INITIATED',
    identifiers: {
      employee_id: row.employeeId,
    },
  });
});

// Send batch
await client.createEvents(events);

// Check progress
const summary = await client.getBatchSummary(batchId);
console.log(`Completed: ${summary.completed}/${summary.total_processes}`);
```

## Fork-Join Pattern (Parallel Steps)

```typescript
// Parallel steps (both have step_sequence = 2)
const odsStep = createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  span_id: 'span-003',
  parent_span_id: 'span-002',
  // ... other fields
  step_sequence: 2,
  step_name: 'Create ODS Entry',
  event_status: EventStatus.SUCCESS,
  // ...
});

const regulatoryStep = createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  span_id: 'span-004',
  parent_span_id: 'span-002',
  // ... other fields
  step_sequence: 2,  // Same as above - parallel
  step_name: 'Initialize Regulatory Controls',
  event_status: EventStatus.SUCCESS,
  // ...
});

// Step that waits for both
const dependentStep = createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  span_id: 'span-005',
  parent_span_id: 'span-002',
  span_links: ['span-003', 'span-004'],  // Waited for both parallel steps
  step_sequence: 3,
  step_name: 'Background Checks',
  event_status: EventStatus.SUCCESS,
  // ...
});
```

## Correlation Links

```typescript
// After account is provisioned
await client.createCorrelationLink({
  correlation_id: 'corr-emp-20250126-a1b2c3',
  account_id: 'AC-EMP-001234',
  application_id: 'APP-998877',
  customer_id: 'EMP-456',
});
```

## Querying Events

```typescript
// Get events by account
const accountEvents = await client.getEventsByAccount('AC-1234567890');

// With filters
const filtered = await client.getEventsByAccount('AC-1234567890', {
  start_date: '2025-01-01T00:00:00Z',
  process_name: 'ADD_AUTH_USER',
  event_status: EventStatus.FAILURE,
  page: 1,
  page_size: 50,
});

// Get by correlation ID
const processEvents = await client.getEventsByCorrelation('corr-emp-20250126-a1b2c3');

// Get by trace ID (distributed tracing)
const traceEvents = await client.getEventsByTrace('4bf92f3577b34da6a3ce929d0e0e4736');
```

## Error Handling

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

## Configuration Options

```typescript
const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',  // Required
  apiKey: 'your-api-key',                           // Optional
  applicationId: 'my-service',                      // Sets X-Application-Id header
  timeout: 30000,                                   // Request timeout (ms)
  maxRetries: 3,                                    // Retry on 5xx/429
  fetch: customFetch,                               // Custom fetch (for testing)
});
```

## Building from Source

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Publishing

### To npm (private registry)

```bash
# Configure .npmrc for your registry
echo "@yourcompany:registry=https://npm.yourcompany.com" >> .npmrc

# Publish
npm publish
```

### To npm (public)

```bash
npm publish --access public
```

## Version Compatibility

| SDK Version | API Version | Node.js Version |
|-------------|-------------|-----------------|
| 1.4.x       | v1.4        | 18+             |
| 1.3.x       | v1.3        | 18+             |

## License

Apache License, Version 2.0
