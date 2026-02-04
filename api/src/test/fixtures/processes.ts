/**
 * Creates a valid process definition request for testing
 */
export function createProcessFixture(
  overrides: Partial<{
    process_name: string;
    display_name: string;
    description: string;
    owning_team: string;
    expected_steps?: number;
    sla_ms?: number;
  }> = {}
) {
  return {
    process_name: 'test-process',
    display_name: 'Test Process',
    description: 'A test process for unit testing',
    owning_team: 'test-team',
    expected_steps: 5,
    sla_ms: 30000,
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
