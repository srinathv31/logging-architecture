---
title: EventLogClient
---

# EventLogClient

The synchronous HTTP client for the Event Log API. Use for special cases where you need confirmation that events were sent. For most use cases, prefer [AsyncEventLogger](/node-sdk/core/async-event-logger).

## Creating a Client

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

## Sending Events

### Single Event

```typescript
const response = await client.createEvent(event);
```

### Batch

```typescript
const batchResponse = await client.createEvents([event1, event2, event3]);
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
    identifiers: { auth_user_ssn_last4: authUserSsn.slice(-4) },
  }));

  // 2. Experian Validation Step
  events.push(createStepEvent({
    correlation_id: correlationId,
    account_id: accountId,
    trace_id: traceId,
    span_id: createSpanId(),
    parent_span_id: events[0].span_id,
    application_id: 'auth-user-service',
    target_system: 'EXPERIAN',
    originating_system: 'MOBILE_APP',
    process_name: processName,
    step_sequence: 1,
    step_name: 'Validate auth user identity',
    event_status: EventStatus.SUCCESS,
    summary: 'Validated authorized user identity',
    result: 'IDENTITY_VERIFIED',
    identifiers: { auth_user_id: 'AU-111222' },
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
    summary: 'Add Authorized User completed',
    result: 'COMPLETED',
    identifiers: { auth_user_id: 'AU-111222' },
    execution_time_ms: Date.now() - startTime,
  }));

  return client.createEvents(events);
}
```
