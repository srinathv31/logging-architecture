// ============================================================================
// FLUENT BUILDER EXAMPLE
// ============================================================================
//
// Use eventBuilder() when you need full control over a single event
// outside the EventLogTemplate / ProcessLogger pattern.
//
// Common use cases:
//   - Standalone audit events not tied to a multi-step process
//   - Webhook receipt logging
//   - Ad-hoc events with unusual field combinations

import {
  EventLogClient,
  AsyncEventLogger,
  EventType,
  EventStatus,
  HttpMethod,
  eventBuilder,
  createCorrelationId,
  createTraceId,
  createSpanId,
} from '@yourcompany/eventlog-sdk';

// Setup (same as real-time-logging.ts)
const client = new EventLogClient({
  baseUrl: 'https://eventlog-api.yourcompany.com',
  apiKey: 'your-api-key',
});

const eventLog = new AsyncEventLogger({ client });

// ============================================================================
// Example 1: Standalone audit event
// ============================================================================

const auditEvent = eventBuilder()
  .correlationId(createCorrelationId('audit'))
  .traceId(createTraceId())
  .spanId(createSpanId())
  .applicationId('admin-portal')
  .targetSystem('USER_MANAGEMENT')
  .originatingSystem('ADMIN_PORTAL')
  .processName('USER_ROLE_CHANGE')
  .eventType(EventType.STEP)
  .eventStatus(EventStatus.SUCCESS)
  .stepSequence(1)
  .stepName('Update Role')
  .identifier('auth_user_id', 'admin-42')
  .identifier('customer_id', 'CUST-99')
  .summary('Role changed from VIEWER to EDITOR by admin-42')
  .result('ROLE_UPDATED')
  .build();

eventLog.log(auditEvent);

// ============================================================================
// Example 2: Webhook receipt with HTTP details
// ============================================================================

const webhookEvent = eventBuilder()
  .correlationId(createCorrelationId('webhook'))
  .traceId(createTraceId())
  .spanId(createSpanId())
  .applicationId('webhook-handler')
  .targetSystem('PAYMENT_PROCESSOR')
  .originatingSystem('STRIPE')
  .processName('PAYMENT_WEBHOOK')
  .eventType(EventType.STEP)
  .eventStatus(EventStatus.SUCCESS)
  .stepSequence(1)
  .stepName('Receive Payment Notification')
  .identifier('payment_id', 'pay_abc123')
  .identifier('transaction_id', 'txn_xyz789')
  .summary('Payment webhook received - $150.00 succeeded')
  .result('PAYMENT_CONFIRMED')
  .endpoint('/webhooks/stripe')
  .httpMethod(HttpMethod.POST)
  .httpStatusCode(200)
  .executionTimeMs(12)
  .build();

eventLog.log(webhookEvent);

// Cleanup
eventLog.shutdown();
