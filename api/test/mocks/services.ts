// Mock service functions for route testing
import { vi } from 'vitest';
import { createEventLogDbRecord } from '../fixtures/events';
import { createCorrelationLinkDbRecord } from '../fixtures/correlation-links';
import { createProcessDbRecord } from '../fixtures/processes';
import { createAccountSummaryDbRecord } from '../fixtures/account-summary';

// Event Log Service Mocks
export const mockEventLogService = {
  createEvent: vi.fn().mockResolvedValue(createEventLogDbRecord()),
  createEvents: vi.fn().mockResolvedValue({ executionIds: ['exec-1'], errors: [] }),
  getByAccount: vi.fn().mockResolvedValue({
    events: [createEventLogDbRecord()],
    totalCount: 1,
    hasMore: false,
  }),
  getByCorrelation: vi.fn().mockResolvedValue({
    events: [createEventLogDbRecord()],
    accountId: 'test-account-id',
    isLinked: true,
  }),
  getByTrace: vi.fn().mockResolvedValue({
    events: [createEventLogDbRecord()],
    systemsInvolved: ['system-a', 'system-b'],
    totalDurationMs: 5000,
  }),
  searchText: vi.fn().mockResolvedValue({
    events: [createEventLogDbRecord()],
    totalCount: 1,
  }),
  createBatchUpload: vi.fn().mockResolvedValue({
    correlationIds: ['corr-1'],
    totalInserted: 1,
    errors: [],
  }),
  getByBatch: vi.fn().mockResolvedValue({
    events: [createEventLogDbRecord()],
    totalCount: 1,
    uniqueCorrelationIds: 1,
    successCount: 1,
    failureCount: 0,
    hasMore: false,
  }),
  getBatchSummary: vi.fn().mockResolvedValue({
    totalProcesses: 1,
    completed: 1,
    inProgress: 0,
    failed: 0,
    correlationIds: ['corr-1'],
    startedAt: '2024-01-01T00:00:00.000Z',
    lastEventAt: '2024-01-01T01:00:00.000Z',
  }),
  deleteAll: vi.fn().mockResolvedValue(undefined),
};

// Correlation Link Service Mocks
export const mockCorrelationLinkService = {
  createCorrelationLink: vi.fn().mockResolvedValue(createCorrelationLinkDbRecord()),
  getCorrelationLink: vi.fn().mockResolvedValue(createCorrelationLinkDbRecord()),
};

// Account Summary Service Mocks
export const mockAccountSummaryService = {
  getAccountSummary: vi.fn().mockResolvedValue({
    summary: createAccountSummaryDbRecord(),
    recentEvents: [createEventLogDbRecord()],
    recentErrors: [createEventLogDbRecord({ eventStatus: 'FAILURE' })],
  }),
};

// Process Definition Service Mocks
export const mockProcessDefinitionService = {
  listProcesses: vi.fn().mockResolvedValue([createProcessDbRecord()]),
  createProcess: vi.fn().mockResolvedValue(createProcessDbRecord()),
};

// Reset all mocks
export function resetAllMocks() {
  Object.values(mockEventLogService).forEach((mock) => mock.mockClear());
  Object.values(mockCorrelationLinkService).forEach((mock) => mock.mockClear());
  Object.values(mockAccountSummaryService).forEach((mock) => mock.mockClear());
  Object.values(mockProcessDefinitionService).forEach((mock) => mock.mockClear());
}
