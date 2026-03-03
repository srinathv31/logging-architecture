// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSetProcessName = vi.fn();
const mockSetAccountId = vi.fn();
const mockSetTraceId = vi.fn();
const mockSetCorrelationId = vi.fn();
const mockSetEventStatus = vi.fn();
const mockSetHasErrors = vi.fn();
const mockSetStartDate = vi.fn();
const mockSetEndDate = vi.fn();
const mockSetPage = vi.fn();

vi.mock('nuqs', () => ({
  useQueryState: (key: string) => {
    switch (key) {
      case 'processName': return ['', mockSetProcessName];
      case 'accountId': return ['', mockSetAccountId];
      case 'traceId': return ['', mockSetTraceId];
      case 'correlationId': return ['', mockSetCorrelationId];
      case 'eventStatus': return ['', mockSetEventStatus];
      case 'hasErrors': return ['', mockSetHasErrors];
      case 'startDate': return ['', mockSetStartDate];
      case 'endDate': return ['', mockSetEndDate];
      case 'page': return [1, mockSetPage];
      default: return ['', vi.fn()];
    }
  },
  parseAsString: { withDefault: () => ({ withOptions: () => ({}) }) },
  parseAsInteger: { withDefault: () => ({ withOptions: () => ({}) }) },
}));

vi.mock('@/lib/constants', () => ({
  EVENT_STATUSES: ['SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED', 'WARNING'],
  STATUS_ICONS: {},
  STATUS_DOT_COLORS: {
    SUCCESS: 'bg-green-500',
    FAILURE: 'bg-red-500',
    IN_PROGRESS: 'bg-yellow-500',
    SKIPPED: 'bg-gray-400',
    WARNING: 'bg-amber-500',
  },
}));

import { TraceFilters } from '@/components/traces/trace-filters';

describe('TraceFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filter inputs in accordion sections', () => {
    render(<TraceFilters><div>table content</div></TraceFilters>);

    expect(screen.getAllByPlaceholderText('Search...').length).toBe(2);
    expect(screen.getAllByPlaceholderText('Exact match...').length).toBe(2);
    expect(screen.getByText('Process Name')).toBeDefined();
    expect(screen.getByText('Account ID')).toBeDefined();
    expect(screen.getByText('Trace ID')).toBeDefined();
    expect(screen.getByText('Correlation ID')).toBeDefined();
  });

  it('renders Filters label', () => {
    render(<TraceFilters><div>table content</div></TraceFilters>);

    // The panel has "Filters" text
    expect(screen.getAllByText('Filters').length).toBeGreaterThan(0);
  });

  it('renders children (table content)', () => {
    render(<TraceFilters><div>my table content</div></TraceFilters>);

    expect(screen.getByText('my table content')).toBeDefined();
  });

  it('renders accordion sections', () => {
    render(<TraceFilters><div>table content</div></TraceFilters>);

    expect(screen.getByText('Time')).toBeDefined();
    expect(screen.getByText('Identifiers')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
  });

  it('renders errors only button', () => {
    render(<TraceFilters><div>table content</div></TraceFilters>);

    expect(screen.getByText('Errors Only')).toBeDefined();
  });

  it('does not show Clear all button when no filters active', () => {
    render(<TraceFilters><div>table content</div></TraceFilters>);

    expect(screen.queryByText('Clear all')).toBeNull();
  });

  it('does not show active badge when no filters active', () => {
    render(<TraceFilters><div>table content</div></TraceFilters>);

    expect(screen.queryByText(/active/)).toBeNull();
  });
});
