---
title: Event Builders
---

# Event Builders

The SDK provides helper functions for creating properly structured events with correct `event_type` values.

## Available Builders

```typescript
import {
  createProcessStartEvent,
  createStepEvent,
  createProcessEndEvent,
  createCorrelationId,
  createTraceId,
  createSpanId,
  createBatchId,
  generateSummary,
  maskLast4,
  EventStatus,
  HttpMethod,
} from '@yourcompany/eventlog-sdk';
```

### createProcessStartEvent

Creates a `PROCESS_START` event:

```typescript
const startEvent = createProcessStartEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  application_id: 'auth-user-service',
  target_system: 'SELF',
  originating_system: 'MOBILE_APP',
  process_name: 'ADD_AUTH_USER',
  summary: 'Initiated Add Authorized User request',
  result: 'INITIATED',
  identifiers: { auth_user_ssn_last4: '5678' },
});
```

### createStepEvent

Creates a `STEP` event:

```typescript
const stepEvent = createStepEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  process_name: 'ADD_AUTH_USER',
  step_sequence: 1,
  step_name: 'Validate auth user identity',
  event_status: EventStatus.SUCCESS,
  summary: 'Validated authorized user identity',
  result: 'IDENTITY_VERIFIED',
  execution_time_ms: 920,
});
```

### createProcessEndEvent

Creates a `PROCESS_END` event:

```typescript
const endEvent = createProcessEndEvent({
  correlation_id: correlationId,
  trace_id: traceId,
  process_name: 'ADD_AUTH_USER',
  step_sequence: 5,
  event_status: EventStatus.SUCCESS,
  summary: 'Add Authorized User completed',
  result: 'COMPLETED',
  execution_time_ms: Date.now() - startTime,
});
```

## ID Generation Helpers

```typescript
// Correlation ID with team prefix
const correlationId = createCorrelationId('auth');
// e.g., "auth-a1b2c3d4-e5f6g7h8"

// W3C Trace Context trace ID (32 lowercase hex chars)
const traceId = createTraceId();

// Span ID (16 lowercase hex chars)
const spanId = createSpanId();

// Batch ID with prefix
const batchId = createBatchId('hr-upload');
```

## Summary Helpers

```typescript
const summary = generateSummary({
  action: 'Validated authorized user Jane Doe',
  target: '(SSN ***5678)',
  outcome: 'identity confirmed',
  details: 'fraud score 0.08',
});
// "Validated authorized user Jane Doe (SSN ***5678) - identity confirmed - fraud score 0.08"

const masked = maskLast4('123456789');
// "***6789"
```
