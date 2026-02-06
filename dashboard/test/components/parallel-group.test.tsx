// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('nuqs', () => ({
  useQueryState: () => [null, vi.fn()],
  parseAsString: { withDefault: () => ({ withOptions: () => ({}) }) },
}));

import { ParallelGroup } from '@/components/trace-detail/parallel-group';

describe('formatTimeDiff', () => {
  it('shows milliseconds for <1000ms', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventTimestamp: '2025-01-01T00:00:00.500Z' }),
    ];
    const firstTimestamp = new Date('2025-01-01T00:00:00.000Z').getTime();

    const { container } = render(
      <ParallelGroup events={events} firstTimestamp={firstTimestamp} />
    );

    expect(container.textContent).toContain('+500ms');
  });

  it('shows seconds for <60000ms', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventTimestamp: '2025-01-01T00:00:05.000Z' }),
    ];
    const firstTimestamp = new Date('2025-01-01T00:00:00.000Z').getTime();

    const { container } = render(
      <ParallelGroup events={events} firstTimestamp={firstTimestamp} />
    );

    expect(container.textContent).toContain('+5.0s');
  });

  it('shows minutes for >=60000ms', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventTimestamp: '2025-01-01T00:02:00.000Z' }),
    ];
    const firstTimestamp = new Date('2025-01-01T00:00:00.000Z').getTime();

    const { container } = render(
      <ParallelGroup events={events} firstTimestamp={firstTimestamp} />
    );

    expect(container.textContent).toContain('+2.0m');
  });
});

describe('ParallelGroup', () => {
  it('renders "Parallel Execution" label', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventTimestamp: '2025-01-01T00:00:00.000Z' }),
    ];

    render(
      <ParallelGroup events={events} firstTimestamp={new Date('2025-01-01T00:00:00.000Z').getTime()} />
    );

    expect(screen.getByText('Parallel Execution')).toBeDefined();
  });

  it('renders "Synchronized" merge label', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventTimestamp: '2025-01-01T00:00:00.000Z' }),
    ];

    render(
      <ParallelGroup events={events} firstTimestamp={new Date('2025-01-01T00:00:00.000Z').getTime()} />
    );

    expect(screen.getByText('Synchronized')).toBeDefined();
  });

  it('hides time offset when timeDiff is 0', () => {
    const ts = '2025-01-01T00:00:00.000Z';
    const events = [
      makeTraceEvent({ eventLogId: 1, eventTimestamp: ts }),
    ];

    const { container } = render(
      <ParallelGroup events={events} firstTimestamp={new Date(ts).getTime()} />
    );

    // Should not have any time diff badge
    expect(container.textContent).not.toMatch(/\+\d/);
  });

  it('renders a StepCard per event', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventTimestamp: '2025-01-01T00:00:00.000Z', stepName: 'Step A' }),
      makeTraceEvent({ eventLogId: 2, eventTimestamp: '2025-01-01T00:00:00.000Z', stepName: 'Step B' }),
      makeTraceEvent({ eventLogId: 3, eventTimestamp: '2025-01-01T00:00:00.000Z', stepName: 'Step C' }),
    ];

    const { container } = render(
      <ParallelGroup events={events} firstTimestamp={new Date('2025-01-01T00:00:00.000Z').getTime()} />
    );

    expect(container.textContent).toContain('Step A');
    expect(container.textContent).toContain('Step B');
    expect(container.textContent).toContain('Step C');
  });
});
