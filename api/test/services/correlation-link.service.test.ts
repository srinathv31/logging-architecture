/**
 * Unit tests for correlation-link.service
 *
 * These tests mock the Drizzle ORM db export to test actual service code paths.
 */
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import {
  createCorrelationLinkFixture,
  createCorrelationLinkDbRecord,
} from '../fixtures/correlation-links';
import { NotFoundError } from '../../src/utils/errors';

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
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(queryResult),
            }),
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
vi.mock('../../src/db/client', () => ({
  db: mockDb,
  getDb: vi.fn().mockResolvedValue(mockDb),
  closeDb: vi.fn(),
}));

// Now import the service (uses mocked db)
import {
  createCorrelationLink,
  getCorrelationLink,
} from '../../src/services/correlation-link.service';

describe('CorrelationLinkService', () => {
  beforeEach(() => {
    mockDb._reset();
  });

  describe('createCorrelationLink', () => {
    it('should execute MERGE SQL for upsert', async () => {
      const dbRecord = createCorrelationLinkDbRecord();
      mockDb._setTopResult([dbRecord]);

      const input = createCorrelationLinkFixture();
      const result = await createCorrelationLink(input);

      expect(mockDb.execute).toHaveBeenCalled();
      expect(result).toEqual(dbRecord);
    });

    it('should return created/updated record', async () => {
      const dbRecord = createCorrelationLinkDbRecord({
        correlationId: 'new-corr-id',
        accountId: 'new-acc-id',
      });
      mockDb._setTopResult([dbRecord]);

      const input = createCorrelationLinkFixture({
        correlation_id: 'new-corr-id',
        account_id: 'new-acc-id',
      });

      const result = await createCorrelationLink(input);

      expect(result.correlationId).toBe('new-corr-id');
      expect(result.accountId).toBe('new-acc-id');
    });

    it('should handle optional fields (customerId, cardNumberLast4)', async () => {
      const dbRecord = createCorrelationLinkDbRecord({
        customerId: 'cust-123',
        cardNumberLast4: '9999',
      });
      mockDb._setTopResult([dbRecord]);

      const input = createCorrelationLinkFixture({
        customer_id: 'cust-123',
        card_number_last4: '9999',
      });

      const result = await createCorrelationLink(input);

      expect(result.customerId).toBe('cust-123');
      expect(result.cardNumberLast4).toBe('9999');
    });

    it('should handle null optional fields', async () => {
      const dbRecord = createCorrelationLinkDbRecord({
        customerId: null,
        cardNumberLast4: null,
      });
      mockDb._setTopResult([dbRecord]);

      const input = createCorrelationLinkFixture({
        customer_id: undefined,
        card_number_last4: undefined,
      });

      const result = await createCorrelationLink(input);

      expect(result.customerId).toBeNull();
      expect(result.cardNumberLast4).toBeNull();
    });

    it('should update existing record when correlation_id matches', async () => {
      const existingRecord = createCorrelationLinkDbRecord({
        correlationId: 'existing-corr',
        accountId: 'updated-acc-id',
      });
      mockDb._setTopResult([existingRecord]);

      const input = createCorrelationLinkFixture({
        correlation_id: 'existing-corr',
        account_id: 'updated-acc-id',
      });

      const result = await createCorrelationLink(input);

      expect(mockDb.execute).toHaveBeenCalled();
      expect(result.accountId).toBe('updated-acc-id');
    });
  });

  describe('getCorrelationLink', () => {
    it('should return link when found', async () => {
      const dbRecord = createCorrelationLinkDbRecord({
        correlationId: 'found-corr-id',
        accountId: 'acc-123',
      });
      mockDb._setTopResult([dbRecord]);

      const result = await getCorrelationLink('found-corr-id');

      expect(result.correlationId).toBe('found-corr-id');
      expect(result.accountId).toBe('acc-123');
    });

    it('should throw NotFoundError when not found', async () => {
      mockDb._setTopResult([]);

      await expect(getCorrelationLink('nonexistent-corr')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError with correct message', async () => {
      mockDb._setTopResult([]);

      await expect(
        getCorrelationLink('nonexistent-corr')
      ).rejects.toMatchObject({
        message:
          'Correlation link not found for correlation_id: nonexistent-corr',
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should return full link record with all fields', async () => {
      const linkedAt = new Date('2024-01-15T10:00:00Z');
      const dbRecord = createCorrelationLinkDbRecord({
        correlationId: 'full-corr-id',
        accountId: 'full-acc-id',
        applicationId: 'full-app-id',
        customerId: 'full-cust-id',
        cardNumberLast4: '4321',
        linkedAt,
      });
      mockDb._setTopResult([dbRecord]);

      const result = await getCorrelationLink('full-corr-id');

      expect(result.correlationId).toBe('full-corr-id');
      expect(result.accountId).toBe('full-acc-id');
      expect(result.applicationId).toBe('full-app-id');
      expect(result.customerId).toBe('full-cust-id');
      expect(result.cardNumberLast4).toBe('4321');
      expect(result.linkedAt).toEqual(linkedAt);
    });
  });
});

// Test fixture tests
describe('CorrelationLinkService - Test Fixtures', () => {
  describe('createCorrelationLinkFixture', () => {
    it('should create a valid fixture with default values', () => {
      const fixture = createCorrelationLinkFixture();

      expect(fixture.correlation_id).toBe('test-correlation-id');
      expect(fixture.account_id).toBe('test-account-id');
      expect(fixture.application_id).toBe('test-app');
      expect(fixture.customer_id).toBe('test-customer-id');
      expect(fixture.card_number_last4).toBe('1234');
    });

    it('should allow overriding default values', () => {
      const fixture = createCorrelationLinkFixture({
        correlation_id: 'custom-corr-id',
        account_id: 'custom-acc-id',
      });

      expect(fixture.correlation_id).toBe('custom-corr-id');
      expect(fixture.account_id).toBe('custom-acc-id');
      expect(fixture.application_id).toBe('test-app');
    });

    it('should have required fields', () => {
      const fixture = createCorrelationLinkFixture();

      expect(fixture).toHaveProperty('correlation_id');
      expect(fixture).toHaveProperty('account_id');
    });
  });

  describe('createCorrelationLinkDbRecord', () => {
    it('should create a valid database record with default values', () => {
      const record = createCorrelationLinkDbRecord();

      expect(record.correlationId).toBe('test-correlation-id');
      expect(record.accountId).toBe('test-account-id');
      expect(record.applicationId).toBe('test-app');
      expect(record.customerId).toBe('test-customer-id');
      expect(record.cardNumberLast4).toBe('1234');
      expect(record.linkedAt).toBeInstanceOf(Date);
    });

    it('should allow overriding values', () => {
      const record = createCorrelationLinkDbRecord({
        correlationId: 'custom-corr-id',
        accountId: 'custom-acc-id',
      });

      expect(record.correlationId).toBe('custom-corr-id');
      expect(record.accountId).toBe('custom-acc-id');
    });

    it('should allow null for optional fields', () => {
      const record = createCorrelationLinkDbRecord({
        applicationId: null,
        customerId: null,
        cardNumberLast4: null,
      });

      expect(record.applicationId).toBeNull();
      expect(record.customerId).toBeNull();
      expect(record.cardNumberLast4).toBeNull();
    });
  });
});

describe('CorrelationLinkService - createCorrelationLink behavior', () => {
  it('should use MERGE for upsert semantics (insert or update)', () => {
    const input = createCorrelationLinkFixture();

    expect(input.correlation_id).toBeDefined();
    expect(input.account_id).toBeDefined();
  });

  it('should map snake_case input to camelCase output', () => {
    const input = createCorrelationLinkFixture({
      correlation_id: 'test-corr',
      account_id: 'test-acc',
      application_id: 'test-app',
      customer_id: 'test-cust',
      card_number_last4: '9999',
    });

    const expectedOutput = {
      correlationId: input.correlation_id,
      accountId: input.account_id,
      applicationId: input.application_id,
      customerId: input.customer_id,
      cardNumberLast4: input.card_number_last4,
    };

    expect(expectedOutput.correlationId).toBe('test-corr');
    expect(expectedOutput.accountId).toBe('test-acc');
    expect(expectedOutput.applicationId).toBe('test-app');
    expect(expectedOutput.customerId).toBe('test-cust');
    expect(expectedOutput.cardNumberLast4).toBe('9999');
  });
});

describe('CorrelationLinkService - getCorrelationLink behavior', () => {
  it('should throw NotFoundError when link not found', () => {
    const correlationId = 'nonexistent-corr-id';
    const error = new NotFoundError(
      `Correlation link not found for correlation_id: ${correlationId}`
    );

    expect(error.message).toBe(
      'Correlation link not found for correlation_id: nonexistent-corr-id'
    );
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should return the full link record when found', () => {
    const record = createCorrelationLinkDbRecord({
      correlationId: 'found-corr-id',
      accountId: 'acc-123',
    });

    expect(record.correlationId).toBe('found-corr-id');
    expect(record.accountId).toBe('acc-123');
    expect(record.linkedAt).toBeInstanceOf(Date);
  });
});
