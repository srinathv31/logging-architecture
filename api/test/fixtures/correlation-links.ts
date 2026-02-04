import type { CreateCorrelationLinkRequest } from '../../src/types/api';

/**
 * Creates a valid CreateCorrelationLinkRequest for testing
 */
export function createCorrelationLinkFixture(
  overrides: Partial<CreateCorrelationLinkRequest> = {}
): CreateCorrelationLinkRequest {
  return {
    correlation_id: 'test-correlation-id',
    account_id: 'test-account-id',
    application_id: 'test-app',
    customer_id: 'test-customer-id',
    card_number_last4: '1234',
    ...overrides,
  };
}

/**
 * Creates a mock database correlation link record (returned from DB)
 */
export function createCorrelationLinkDbRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    correlationId: 'test-correlation-id',
    accountId: 'test-account-id',
    applicationId: 'test-app',
    customerId: 'test-customer-id',
    cardNumberLast4: '1234',
    linkedAt: new Date(),
    ...overrides,
  };
}
