import type { CreateCorrelationLinkRequest } from '../../src/types/api';

/**
 * Creates a valid CreateCorrelationLinkRequest for testing
 */
export function createCorrelationLinkFixture(
  overrides: Partial<CreateCorrelationLinkRequest> = {}
): CreateCorrelationLinkRequest {
  return {
    correlationId: 'c1d2e3f4a5b6c7d8c1d2e3f4a5b6c7d8',
    accountId: 'test-account-id',
    applicationId: 'test-app',
    customerId: 'test-customer-id',
    cardNumberLast4: '1234',
    ...overrides,
  };
}

/**
 * Creates a mock database correlation link record (returned from DB)
 */
export function createCorrelationLinkDbRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    correlationId: 'c1d2e3f4a5b6c7d8c1d2e3f4a5b6c7d8',
    accountId: 'test-account-id',
    applicationId: 'test-app',
    customerId: 'test-customer-id',
    cardNumberLast4: '1234',
    linkedAt: new Date(),
    ...overrides,
  };
}
