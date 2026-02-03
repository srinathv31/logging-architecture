// Mock database client for testing
import { vi, type Mock } from 'vitest';

export interface MockQueryBuilder {
  select: Mock;
  from: Mock;
  where: Mock;
  orderBy: Mock;
  offset: Mock;
  fetch: Mock;
  top: Mock;
  insert: Mock;
  values: Mock;
  output: Mock;
  delete: Mock;
  transaction: Mock;
  selectDistinct: Mock;
}

export function createMockDb(): MockQueryBuilder {
  const mockBuilder: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    fetch: vi.fn().mockResolvedValue([]),
    top: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    output: vi.fn().mockResolvedValue([{ executionId: 'test-execution-id' }]),
    delete: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn().mockImplementation(async (callback) => {
      await callback(mockBuilder);
    }),
    selectDistinct: vi.fn().mockReturnThis(),
  };

  // Chain methods properly
  mockBuilder.select.mockReturnValue(mockBuilder);
  mockBuilder.from.mockReturnValue(mockBuilder);
  mockBuilder.where.mockReturnValue(mockBuilder);
  mockBuilder.orderBy.mockReturnValue(mockBuilder);
  mockBuilder.offset.mockReturnValue(mockBuilder);
  mockBuilder.top.mockReturnValue(mockBuilder);
  mockBuilder.insert.mockReturnValue(mockBuilder);
  mockBuilder.values.mockReturnValue(mockBuilder);
  mockBuilder.selectDistinct.mockReturnValue(mockBuilder);

  return mockBuilder;
}

export function createMockDbClient() {
  const mockDb = createMockDb();

  return {
    db: mockDb,
    initializeDb: vi.fn().mockResolvedValue(undefined),
    closeDb: vi.fn().mockResolvedValue(undefined),
  };
}
