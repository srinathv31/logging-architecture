/**
 * Creates a valid process definition request for testing
 */
export function createProcessFixture(
  overrides: Partial<{
    processName: string;
    displayName: string;
    description: string;
    owningTeam: string;
    expectedSteps?: number;
    slaMs?: number;
  }> = {}
) {
  return {
    processName: 'test-process',
    displayName: 'Test Process',
    description: 'A test process for unit testing',
    owningTeam: 'test-team',
    expectedSteps: 5,
    slaMs: 30000,
    ...overrides,
  };
}

/**
 * Creates a mock database process definition record (returned from DB)
 */
export function createProcessDbRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    processId: 1,
    processName: 'test-process',
    displayName: 'Test Process',
    description: 'A test process for unit testing',
    owningTeam: 'test-team',
    expectedSteps: 5,
    slaMs: 30000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
