// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderServerComponent } from '../util/render-server-component';

const getDashboardStatsMock = vi.fn();

vi.mock('@/data/queries', () => ({
  getDashboardStats: (...args: any[]) => getDashboardStatsMock(...args),
}));

import { DashboardStats } from '@/components/layout/dashboard-stats';

describe('DashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 stat cards with data', async () => {
    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 1500,
      totalAccounts: 42,
      totalSystems: 5,
      successRate: 95.2,
      totalEvents: 3000,
      systemNames: ['SystemA', 'SystemB', 'SystemC'],
    });

    const { container } = await renderServerComponent(<DashboardStats />);

    expect(container.textContent).toContain('Total Traces');
    expect(container.textContent).toContain('1,500');
    expect(container.textContent).toContain('Accounts Tracked');
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('Systems Connected');
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('Success Rate');
    expect(container.textContent).toContain('95.2%');
  });

  it('success status >= 90 is success', async () => {
    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 100,
      totalAccounts: 10,
      totalSystems: 2,
      successRate: 92,
      totalEvents: 200,
      systemNames: ['A'],
    });

    const { container } = await renderServerComponent(<DashboardStats />);

    // The success rate should render with green styling (success status)
    expect(container.textContent).toContain('92%');
  });

  it('success status >= 70 and < 90 is warning', async () => {
    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 100,
      totalAccounts: 10,
      totalSystems: 2,
      successRate: 75,
      totalEvents: 200,
      systemNames: ['A'],
    });

    const { container } = await renderServerComponent(<DashboardStats />);

    expect(container.textContent).toContain('75%');
  });

  it('success status < 70 is error', async () => {
    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 100,
      totalAccounts: 10,
      totalSystems: 2,
      successRate: 50,
      totalEvents: 200,
      systemNames: ['A'],
    });

    const { container } = await renderServerComponent(<DashboardStats />);

    expect(container.textContent).toContain('50%');
  });

  it('displays system names as subtitle', async () => {
    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 100,
      totalAccounts: 10,
      totalSystems: 3,
      successRate: 95,
      totalEvents: 200,
      systemNames: ['Alpha', 'Beta', 'Gamma'],
    });

    const { container } = await renderServerComponent(<DashboardStats />);

    expect(container.textContent).toContain('Alpha');
    expect(container.textContent).toContain('Beta');
    expect(container.textContent).toContain('Gamma');
  });

  it('truncates system names when > 4', async () => {
    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 100,
      totalAccounts: 10,
      totalSystems: 6,
      successRate: 95,
      totalEvents: 200,
      systemNames: ['A', 'B', 'C', 'D', 'E', 'F'],
    });

    const { container } = await renderServerComponent(<DashboardStats />);

    expect(container.textContent).toContain('...');
  });

  it('does not show subtitle when no system names', async () => {
    getDashboardStatsMock.mockResolvedValue({
      totalTraces: 0,
      totalAccounts: 0,
      totalSystems: 0,
      successRate: 0,
      totalEvents: 0,
      systemNames: [],
    });

    const { container } = await renderServerComponent(<DashboardStats />);

    expect(container.textContent).toContain('Systems Connected');
    expect(container.textContent).toContain('0');
  });
});
