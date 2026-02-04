/**
 * Creates a mock database account timeline summary record (returned from DB)
 */
export function createAccountSummaryDbRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    accountId: 'test-account-id',
    firstEventAt: new Date('2024-01-01T00:00:00Z'),
    lastEventAt: new Date('2024-01-15T12:00:00Z'),
    totalEvents: 100,
    totalProcesses: 10,
    errorCount: 5,
    lastProcess: 'test-process',
    systemsTouched: ['system-a', 'system-b', 'system-c'],
    correlationIds: ['corr-1', 'corr-2', 'corr-3'],
    updatedAt: new Date(),
    ...overrides,
  };
}
