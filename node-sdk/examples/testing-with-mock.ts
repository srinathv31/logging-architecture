// ============================================================================
// TESTING WITH MockAsyncEventLogger
// ============================================================================
//
// This example shows how to use MockAsyncEventLogger to test business logic
// that logs events, without making any network calls.
//
// Import from '@yourcompany/eventlog-sdk/testing' — a separate entrypoint
// so the mock is never bundled into production code.

import { EventLogTemplate, EventStatus } from '@yourcompany/eventlog-sdk';
import { MockAsyncEventLogger } from '@yourcompany/eventlog-sdk/testing';

// ============================================================================
// YOUR SERVICE UNDER TEST
// ============================================================================

// In real code, EventLogTemplate is injected via constructor / DI
class PaymentService {
  constructor(private readonly template: EventLogTemplate) {}

  async processPayment(accountId: string, amount: number): Promise<void> {
    const process = this.template.forProcess('PROCESS_PAYMENT', {
      accountId,
      identifiers: { payment_id: `PAY-${Date.now()}` },
    });

    process.logStart(`Processing payment of $${amount}`);

    // ... business logic ...
    const approved = amount < 10_000;

    if (approved) {
      process.logStep(1, 'Authorize', EventStatus.SUCCESS, `Payment of $${amount} authorized`);
      process.logEnd(EventStatus.SUCCESS, 'Payment completed', 250);
    } else {
      process.logStep(1, 'Authorize', EventStatus.FAILURE, `Payment of $${amount} declined - over limit`);
      process.logError('Payment declined', 'OVER_LIMIT', `Amount $${amount} exceeds $10,000 limit`);
    }
  }
}

// ============================================================================
// TEST EXAMPLES (using vitest/jest-style assertions)
// ============================================================================

async function testSuccessfulPayment() {
  // Arrange
  const mockLogger = new MockAsyncEventLogger();
  const template = new EventLogTemplate({
    logger: mockLogger as any,
    applicationId: 'payment-service',
    targetSystem: 'PAYMENT_GATEWAY',
    originatingSystem: 'CHECKOUT_APP',
  });
  const service = new PaymentService(template);

  // Act
  await service.processPayment('AC-123', 500);

  // Assert — events were logged correctly
  const events = mockLogger.getEventsForProcess('PROCESS_PAYMENT');
  console.assert(events.length === 3, `Expected 3 events, got ${events.length}`);

  // Verify specific event types were logged
  mockLogger.assertEventLogged('PROCESS_PAYMENT', 'PROCESS_START');
  mockLogger.assertEventLogged('PROCESS_PAYMENT', 'STEP', 'SUCCESS');
  mockLogger.assertEventLogged('PROCESS_PAYMENT', 'PROCESS_END', 'SUCCESS');

  console.log('testSuccessfulPayment PASSED');
}

async function testDeclinedPayment() {
  // Arrange
  const mockLogger = new MockAsyncEventLogger();
  const template = new EventLogTemplate({
    logger: mockLogger as any,
    applicationId: 'payment-service',
    targetSystem: 'PAYMENT_GATEWAY',
    originatingSystem: 'CHECKOUT_APP',
  });
  const service = new PaymentService(template);

  // Act
  await service.processPayment('AC-456', 50_000);

  // Assert
  mockLogger.assertEventLogged('PROCESS_PAYMENT', 'STEP', 'FAILURE');
  mockLogger.assertEventLogged('PROCESS_PAYMENT', 'ERROR', 'FAILURE');

  // Verify error details
  const errorEvent = mockLogger.capturedEvents.find(e => e.event_type === 'ERROR');
  console.assert(errorEvent?.error_code === 'OVER_LIMIT', 'Expected OVER_LIMIT error code');
  console.assert(errorEvent?.error_message?.includes('$10,000'), 'Expected limit in error message');

  console.log('testDeclinedPayment PASSED');
}

async function testMockReset() {
  const mockLogger = new MockAsyncEventLogger();
  const template = new EventLogTemplate({
    logger: mockLogger as any,
    applicationId: 'test-app',
    targetSystem: 'TEST',
    originatingSystem: 'TEST',
  });

  // First test
  const p1 = template.forProcess('FLOW_A');
  p1.logStart('Starting A');
  console.assert(mockLogger.capturedEvents.length === 1, 'Expected 1 event');

  // Reset between tests to get a clean slate
  mockLogger.reset();
  console.assert(mockLogger.capturedEvents.length === 0, 'Expected 0 events after reset');

  // Second test
  const p2 = template.forProcess('FLOW_B');
  p2.logStart('Starting B');
  console.assert(mockLogger.capturedEvents.length === 1, 'Expected 1 event after second test');

  console.log('testMockReset PASSED');
}

// Run all tests
(async () => {
  await testSuccessfulPayment();
  await testDeclinedPayment();
  await testMockReset();
  console.log('\nAll tests passed!');
})();
