// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderServerComponent } from '../util/render-server-component';

const getTracesMock = vi.fn();
const getDashboardStatsMock = vi.fn();

vi.mock('@/data/queries', () => ({
  getTraces: (...args: any[]) => getTracesMock(...args),
  getDashboardStats: (...args: any[]) => getDashboardStatsMock(...args),
}));

vi.mock('@/lib/search-params', () => ({
  searchParamsCache: {
    parse: (params: any) => ({
      processName: '',
      batchId: '',
      accountId: '',
      eventStatus: '',
      startDate: '',
      endDate: '',
      page: 1,
      ...params,
    }),
  },
}));

vi.mock('nuqs/adapters/next/app', () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('nuqs', () => ({
  useQueryState: () => ['', vi.fn()],
  parseAsString: { withDefault: () => ({ withOptions: () => ({}) }) },
  parseAsInteger: { withDefault: () => ({ withOptions: () => ({}) }) },
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/constants', () => ({
  EVENT_STATUSES: ['SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED'],
  STATUS_ICONS: {},
}));

import HomePage from '@/app/page';

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 100,
      totalAccounts: 10,
      totalSystems: 3,
      successRate: 95,
      totalEvents: 500,
      systemNames: ['A', 'B', 'C'],
    });

    getTracesMock.mockResolvedValue({
      traces: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    });
  });

  it('renders hero section headline', async () => {
    const { container } = await renderServerComponent(
      <HomePage searchParams={Promise.resolve({})} />
    );

    expect(container.textContent).toContain('Complete Visibility Into');
    expect(container.textContent).toContain('Every Customer Journey');
  });

  it('renders enterprise integration platform badge', async () => {
    const { container } = await renderServerComponent(
      <HomePage searchParams={Promise.resolve({})} />
    );

    expect(container.textContent).toContain('Enterprise Integration Platform');
  });

  it('renders description text', async () => {
    const { container } = await renderServerComponent(
      <HomePage searchParams={Promise.resolve({})} />
    );

    expect(container.textContent).toContain('One unified API that tracks interactions across');
    expect(container.textContent).toContain('all your enterprise systems');
  });

  it('renders value pills', async () => {
    const { container } = await renderServerComponent(
      <HomePage searchParams={Promise.resolve({})} />
    );

    expect(container.textContent).toContain('Multi-System Tracing');
    expect(container.textContent).toContain('Journey Correlation');
    expect(container.textContent).toContain('Real-Time Insights');
  });

  it('renders DashboardStats section', async () => {
    const { container } = await renderServerComponent(
      <HomePage searchParams={Promise.resolve({})} />
    );

    expect(container.textContent).toContain('Total Traces');
    expect(container.textContent).toContain('100');
  });

  it('renders TraceFilters component', async () => {
    const { container } = await renderServerComponent(
      <HomePage searchParams={Promise.resolve({})} />
    );

    expect(container.textContent).toContain('Filters');
  });

  it('passes parsed filter params to TraceTableServer', async () => {
    await renderServerComponent(
      <HomePage searchParams={Promise.resolve({ processName: 'myProc', page: '2' })} />
    );

    expect(getTracesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        processName: 'myProc',
      }),
    );
  });
});
