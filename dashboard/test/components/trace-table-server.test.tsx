// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderServerComponent } from '../util/render-server-component';
import { makeTraceSummary, makeTraceListResult } from '../util/fixtures';

const getTracesMock = vi.fn();

vi.mock('@/data/queries', () => ({
  getTraces: (...args: any[]) => getTracesMock(...args),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('nuqs', () => ({
  useQueryState: () => [null, vi.fn()],
  parseAsInteger: { withDefault: () => ({}) },
}));

import { TraceTableServer } from '@/components/traces/trace-table-server';

describe('TraceTableServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table with trace data', async () => {
    const traces = [
      makeTraceSummary({ traceId: 'abc-123', processName: 'process_a' }),
      makeTraceSummary({ traceId: 'def-456', processName: 'process_b' }),
    ];
    getTracesMock.mockResolvedValue(makeTraceListResult({ traces, totalCount: 2 }));

    const { container } = await renderServerComponent(
      <TraceTableServer filters={{}} />
    );

    expect(container.textContent).toContain('abc-123');
    expect(container.textContent).toContain('def-456');
  });

  it('renders "No traces found" for empty result', async () => {
    getTracesMock.mockResolvedValue(makeTraceListResult({ traces: [], totalCount: 0 }));

    const { container } = await renderServerComponent(
      <TraceTableServer filters={{}} />
    );

    expect(container.textContent).toContain('No traces found');
  });

  it('passes filters to getTraces', async () => {
    const filters = { processName: 'my_process', page: 2, pageSize: 10 };
    getTracesMock.mockResolvedValue(makeTraceListResult());

    await renderServerComponent(<TraceTableServer filters={filters} />);

    expect(getTracesMock).toHaveBeenCalledWith(filters);
  });

  it('renders pagination for multiple pages', async () => {
    getTracesMock.mockResolvedValue(
      makeTraceListResult({ page: 2, totalPages: 5, totalCount: 125 })
    );

    const { container } = await renderServerComponent(
      <TraceTableServer filters={{}} />
    );

    expect(container.textContent).toContain('Page 2 of 5');
    expect(container.textContent).toContain('Previous');
    expect(container.textContent).toContain('Next');
  });

  it('single page shows count only', async () => {
    getTracesMock.mockResolvedValue(
      makeTraceListResult({ page: 1, totalPages: 1, totalCount: 3 })
    );

    const { container } = await renderServerComponent(
      <TraceTableServer filters={{}} />
    );

    expect(container.textContent).toContain('3 traces');
    expect(container.textContent).not.toContain('Previous');
    expect(container.textContent).not.toContain('Next');
  });
});
