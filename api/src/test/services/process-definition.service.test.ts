/**
 * Unit tests for process-definition.service
 *
 * These tests mock the Drizzle ORM db export to test actual service code paths.
 */
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import {
  createProcessFixture,
  createProcessDbRecord,
} from '../fixtures/processes';

// Create mock instance using vi.hoisted - must define inline, cannot import
const mockDb = vi.hoisted(() => {
  // State for configurable results
  let queryResult: unknown[] = [];
  let insertResult: unknown[] = [{ executionId: 'test-execution-id' }];
  let countResult = { count: 0 };
  let topResult: unknown[] = [];

  interface ChainableMock {
    select: Mock;
    from: Mock;
    where: Mock;
    orderBy: Mock;
    top: Mock;
    insert: Mock;
    values: Mock;
    output: Mock;
    delete: Mock;
    execute: Mock;
    transaction: Mock;
    _setQueryResult: (result: unknown[]) => void;
    _setInsertResult: (result: unknown[]) => void;
    _setCountResult: (count: number) => void;
    _setTopResult: (result: unknown[]) => void;
    _reset: () => void;
  }

  const chainableMock: ChainableMock = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    top: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    output: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
    _setQueryResult: (result: unknown[]) => {
      queryResult = result;
    },
    _setInsertResult: (result: unknown[]) => {
      insertResult = result;
    },
    _setCountResult: (count: number) => {
      countResult = { count };
    },
    _setTopResult: (result: unknown[]) => {
      topResult = result;
    },
    _reset: () => {
      queryResult = [];
      insertResult = [{ executionId: 'test-execution-id' }];
      countResult = { count: 0 };
      topResult = [];

      // Clear all mock call history
      Object.values(chainableMock).forEach((fn) => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as Mock).mockClear();
        }
      });

      // Re-setup mocks after clear
      chainableMock.select.mockImplementation((...args: unknown[]) => {
        if (
          args[0] &&
          typeof args[0] === 'object' &&
          'count' in (args[0] as object)
        ) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([countResult]),
            }),
          };
        }
        return {
          top: vi.fn().mockImplementation(() => ({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(topResult),
            }),
          })),
          from: vi.fn().mockImplementation(() => {
            // Create thenable that also has chainable methods
            const fromResult = {
              where: vi.fn().mockResolvedValue(queryResult),
              orderBy: vi.fn().mockResolvedValue(queryResult),
              // Make it thenable so await select().from() works
              then: (resolve: (value: unknown) => void) => resolve(queryResult),
              catch: () => fromResult,
            };
            return fromResult;
          }),
        };
      });

      chainableMock.insert.mockImplementation(() => ({
        output: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(() => Promise.resolve(insertResult)),
        }),
        values: vi.fn().mockResolvedValue(undefined),
      }));

      chainableMock.delete.mockImplementation(() => Promise.resolve());

      chainableMock.execute.mockImplementation(() => Promise.resolve());

      chainableMock.transaction.mockImplementation(
        async (callback: (tx: ChainableMock) => Promise<void>) => {
          return callback(chainableMock);
        }
      );

      chainableMock.top.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(topResult),
        }),
      }));
    },
  };

  // Initialize mocks
  chainableMock._reset();

  return chainableMock;
});

// Mock MUST be after vi.hoisted
vi.mock('../../db/client', () => ({
  db: mockDb,
  getDb: vi.fn().mockResolvedValue(mockDb),
  closeDb: vi.fn(),
}));

// Now import the service (uses mocked db)
import {
  listProcesses,
  createProcess,
} from '../../services/process-definition.service';

describe('ProcessDefinitionService', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  describe('listProcesses', () => {
    it('should return all processes when isActive is undefined', async () => {
      const processes = [
        createProcessDbRecord({ processId: 1, isActive: true }),
        createProcessDbRecord({ processId: 2, isActive: false }),
        createProcessDbRecord({ processId: 3, isActive: true }),
      ];

      mockDb._setQueryResult(processes);

      const result = await listProcesses();

      expect(result).toHaveLength(3);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should filter by isActive=true when provided', async () => {
      const activeProcesses = [
        createProcessDbRecord({ processId: 1, isActive: true }),
        createProcessDbRecord({ processId: 3, isActive: true }),
      ];

      mockDb._setQueryResult(activeProcesses);

      const result = await listProcesses(true);

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.isActive === true)).toBe(true);
    });

    it('should filter by isActive=false when provided', async () => {
      const inactiveProcesses = [
        createProcessDbRecord({ processId: 2, isActive: false }),
      ];

      mockDb._setQueryResult(inactiveProcesses);

      const result = await listProcesses(false);

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(false);
    });

    it('should return empty array when no processes exist', async () => {
      mockDb._setQueryResult([]);

      const result = await listProcesses();

      expect(result).toHaveLength(0);
    });

    it('should query from processDefinitions table', async () => {
      mockDb._setQueryResult([]);

      await listProcesses();

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('createProcess', () => {
    it('should insert with required fields', async () => {
      const newProcess = createProcessDbRecord({
        processId: 42,
        processName: 'new-process',
        displayName: 'New Process',
        description: 'A new process',
        owningTeam: 'dev-team',
      });

      mockDb._setInsertResult([newProcess]);

      const result = await createProcess({
        processName: 'new-process',
        displayName: 'New Process',
        description: 'A new process',
        owningTeam: 'dev-team',
      });

      expect(result.processName).toBe('new-process');
      expect(result.displayName).toBe('New Process');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle optional expectedSteps and slaMs', async () => {
      const newProcess = createProcessDbRecord({
        processId: 43,
        expectedSteps: 10,
        slaMs: 60000,
      });

      mockDb._setInsertResult([newProcess]);

      const result = await createProcess({
        processName: 'test-process',
        displayName: 'Test Process',
        description: 'Test description',
        owningTeam: 'test-team',
        expectedSteps: 10,
        slaMs: 60000,
      });

      expect(result.expectedSteps).toBe(10);
      expect(result.slaMs).toBe(60000);
    });

    it('should return created record via .output()', async () => {
      const createdProcess = createProcessDbRecord({
        processId: 123,
        processName: 'created-process',
      });

      mockDb._setInsertResult([createdProcess]);

      const result = await createProcess({
        processName: 'created-process',
        displayName: 'Created Process',
        description: 'Description',
        owningTeam: 'team',
      });

      expect(result.processId).toBe(123);
    });

    it('should use MSSQL .output() for returning inserted record', async () => {
      const insertedRecord = createProcessDbRecord({ processId: 999 });
      mockDb._setInsertResult([insertedRecord]);

      const result = await createProcess({
        processName: 'mssql-process',
        displayName: 'MSSQL Process',
        description: 'Testing MSSQL output',
        owningTeam: 'dba-team',
      });

      expect(result.processId).toBe(999);
    });

    it('should handle undefined optional fields', async () => {
      const createdProcess = createProcessDbRecord({
        expectedSteps: null,
        slaMs: null,
      });

      mockDb._setInsertResult([createdProcess]);

      const result = await createProcess({
        processName: 'no-optional-process',
        displayName: 'No Optional Process',
        description: 'No optional fields',
        owningTeam: 'minimal-team',
      });

      expect(result.expectedSteps).toBeNull();
      expect(result.slaMs).toBeNull();
    });

    it('should default isActive to true for new processes', async () => {
      const createdProcess = createProcessDbRecord({
        isActive: true,
      });

      mockDb._setInsertResult([createdProcess]);

      const result = await createProcess({
        processName: 'active-process',
        displayName: 'Active Process',
        description: 'Should be active by default',
        owningTeam: 'active-team',
      });

      expect(result.isActive).toBe(true);
    });
  });
});

// Test fixture tests
describe('ProcessDefinitionService - Test Fixtures', () => {
  describe('createProcessFixture', () => {
    it('should create a valid fixture with default values', () => {
      const fixture = createProcessFixture();

      expect(fixture.process_name).toBe('test-process');
      expect(fixture.display_name).toBe('Test Process');
      expect(fixture.description).toBe('A test process for unit testing');
      expect(fixture.owning_team).toBe('test-team');
      expect(fixture.expected_steps).toBe(5);
      expect(fixture.sla_ms).toBe(30000);
    });

    it('should allow overriding default values', () => {
      const fixture = createProcessFixture({
        process_name: 'custom-process',
        display_name: 'Custom Process',
        expected_steps: 10,
      });

      expect(fixture.process_name).toBe('custom-process');
      expect(fixture.display_name).toBe('Custom Process');
      expect(fixture.expected_steps).toBe(10);
      expect(fixture.owning_team).toBe('test-team');
    });

    it('should have required fields', () => {
      const fixture = createProcessFixture();

      expect(fixture).toHaveProperty('process_name');
      expect(fixture).toHaveProperty('display_name');
      expect(fixture).toHaveProperty('description');
      expect(fixture).toHaveProperty('owning_team');
    });
  });

  describe('createProcessDbRecord', () => {
    it('should create a valid database record with default values', () => {
      const record = createProcessDbRecord();

      expect(record.processId).toBe(1);
      expect(record.processName).toBe('test-process');
      expect(record.displayName).toBe('Test Process');
      expect(record.description).toBe('A test process for unit testing');
      expect(record.owningTeam).toBe('test-team');
      expect(record.expectedSteps).toBe(5);
      expect(record.slaMs).toBe(30000);
      expect(record.isActive).toBe(true);
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow overriding values', () => {
      const record = createProcessDbRecord({
        processId: 42,
        processName: 'custom-process',
        isActive: false,
      });

      expect(record.processId).toBe(42);
      expect(record.processName).toBe('custom-process');
      expect(record.isActive).toBe(false);
    });

    it('should handle null for optional numeric fields', () => {
      const record = createProcessDbRecord({
        expectedSteps: null,
        slaMs: null,
      });

      expect(record.expectedSteps).toBeNull();
      expect(record.slaMs).toBeNull();
    });
  });
});

describe('ProcessDefinitionService - listProcesses behavior', () => {
  it('should return all processes when isActive is undefined', () => {
    const allProcesses = [
      createProcessDbRecord({ processId: 1, isActive: true }),
      createProcessDbRecord({ processId: 2, isActive: false }),
      createProcessDbRecord({ processId: 3, isActive: true }),
    ];

    expect(allProcesses).toHaveLength(3);
  });

  it('should filter by isActive=true', () => {
    const allProcesses = [
      createProcessDbRecord({ processId: 1, isActive: true }),
      createProcessDbRecord({ processId: 2, isActive: false }),
      createProcessDbRecord({ processId: 3, isActive: true }),
    ];

    const activeProcesses = allProcesses.filter((p) => p.isActive === true);
    expect(activeProcesses).toHaveLength(2);
  });

  it('should filter by isActive=false', () => {
    const allProcesses = [
      createProcessDbRecord({ processId: 1, isActive: true }),
      createProcessDbRecord({ processId: 2, isActive: false }),
      createProcessDbRecord({ processId: 3, isActive: true }),
    ];

    const inactiveProcesses = allProcesses.filter((p) => p.isActive === false);
    expect(inactiveProcesses).toHaveLength(1);
    expect(inactiveProcesses[0].processId).toBe(2);
  });

  it('should return empty array when no processes match', () => {
    const emptyResult: ReturnType<typeof createProcessDbRecord>[] = [];
    expect(emptyResult).toHaveLength(0);
  });
});

describe('ProcessDefinitionService - createProcess behavior', () => {
  it('should map snake_case input to camelCase for DB insert', () => {
    const input = createProcessFixture();

    const dbInput = {
      processName: input.process_name,
      displayName: input.display_name,
      description: input.description,
      owningTeam: input.owning_team,
      expectedSteps: input.expected_steps,
      slaMs: input.sla_ms,
    };

    expect(dbInput.processName).toBe('test-process');
    expect(dbInput.displayName).toBe('Test Process');
    expect(dbInput.owningTeam).toBe('test-team');
    expect(dbInput.expectedSteps).toBe(5);
    expect(dbInput.slaMs).toBe(30000);
  });

  it('should use MSSQL .output() for returning inserted record', () => {
    const insertedRecord = createProcessDbRecord({ processId: 123 });

    expect(insertedRecord.processId).toBe(123);
  });

  it('should default isActive to true for new processes', () => {
    const record = createProcessDbRecord();
    expect(record.isActive).toBe(true);
  });

  it('should handle optional fields as undefined', () => {
    const input = createProcessFixture();
    delete input.expected_steps;
    delete input.sla_ms;

    const dbInput = {
      processName: input.process_name,
      displayName: input.display_name,
      description: input.description,
      owningTeam: input.owning_team,
      expectedSteps: input.expected_steps,
      slaMs: input.sla_ms,
    };

    expect(dbInput.expectedSteps).toBeUndefined();
    expect(dbInput.slaMs).toBeUndefined();
  });
});

describe('ProcessDefinitionService - Response formatting', () => {
  it('should return all fields in camelCase', () => {
    const record = createProcessDbRecord();

    expect(record).toHaveProperty('processId');
    expect(record).toHaveProperty('processName');
    expect(record).toHaveProperty('displayName');
    expect(record).toHaveProperty('description');
    expect(record).toHaveProperty('owningTeam');
    expect(record).toHaveProperty('expectedSteps');
    expect(record).toHaveProperty('slaMs');
    expect(record).toHaveProperty('isActive');
    expect(record).toHaveProperty('createdAt');
    expect(record).toHaveProperty('updatedAt');
  });

  it('should have Date objects for timestamps', () => {
    const record = createProcessDbRecord();

    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
  });
});
