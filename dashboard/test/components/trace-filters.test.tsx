// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSetProcessName = vi.fn();
const mockSetBatchId = vi.fn();
const mockSetAccountId = vi.fn();
const mockSetEventStatus = vi.fn();
const mockSetPage = vi.fn();

vi.mock('nuqs', () => ({
  useQueryState: (key: string) => {
    switch (key) {
      case 'processName': return ['', mockSetProcessName];
      case 'batchId': return ['', mockSetBatchId];
      case 'accountId': return ['', mockSetAccountId];
      case 'eventStatus': return ['', mockSetEventStatus];
      case 'page': return [1, mockSetPage];
      default: return ['', vi.fn()];
    }
  },
  parseAsString: { withDefault: () => ({ withOptions: () => ({}) }) },
  parseAsInteger: { withDefault: () => ({ withOptions: () => ({}) }) },
}));

vi.mock('@/lib/constants', () => ({
  EVENT_STATUSES: ['SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED'],
  STATUS_ICONS: {},
}));

import { TraceFilters } from '@/components/traces/trace-filters';

describe('TraceFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all filter inputs', () => {
    render(<TraceFilters />);

    expect(screen.getByPlaceholderText('Process name...')).toBeDefined();
    expect(screen.getByPlaceholderText('Batch ID...')).toBeDefined();
    expect(screen.getByPlaceholderText('Account ID...')).toBeDefined();
  });

  it('renders Filters label', () => {
    render(<TraceFilters />);

    expect(screen.getByText('Filters')).toBeDefined();
  });

  it('typing in process name input updates local state', () => {
    render(<TraceFilters />);
    const input = screen.getByPlaceholderText('Process name...');

    fireEvent.change(input, { target: { value: 'test-process' } });

    expect((input as HTMLInputElement).value).toBe('test-process');
  });

  it('typing in batch ID input updates local state', () => {
    render(<TraceFilters />);
    const input = screen.getByPlaceholderText('Batch ID...');

    fireEvent.change(input, { target: { value: 'batch-123' } });

    expect((input as HTMLInputElement).value).toBe('batch-123');
  });

  it('typing in account ID input updates local state', () => {
    render(<TraceFilters />);
    const input = screen.getByPlaceholderText('Account ID...');

    fireEvent.change(input, { target: { value: 'acc-456' } });

    expect((input as HTMLInputElement).value).toBe('acc-456');
  });

  it('does not show Clear all button when no filters active', () => {
    render(<TraceFilters />);

    expect(screen.queryByText('Clear all')).toBeNull();
  });

  it('does not show active badge when no filters active', () => {
    render(<TraceFilters />);

    expect(screen.queryByText(/active/)).toBeNull();
  });
});
