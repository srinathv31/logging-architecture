// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { makeTraceEvent, makeTraceDetail } from '../util/fixtures';

vi.mock('@/lib/span-tree', () => ({
  hasParallelExecution: vi.fn().mockReturnValue(false),
  buildStepFlow: vi.fn().mockReturnValue([]),
}));

import { JourneyNarrative } from '@/components/trace-detail/journey-narrative';
import { hasParallelExecution } from '@/lib/span-tree';

describe('JourneyNarrative', () => {
  it('renders success outcome for all-success events', () => {
    const detail = makeTraceDetail({
      processName: 'order_processing',
      statusCounts: { SUCCESS: 3 },
      totalDurationMs: 1500,
      systemsInvolved: ['Gateway', 'PaymentService'],
      events: [
        makeTraceEvent({ targetSystem: 'Gateway' }),
        makeTraceEvent({ targetSystem: 'PaymentService' }),
        makeTraceEvent({ targetSystem: 'Gateway', eventType: 'PROCESS_END', eventStatus: 'SUCCESS' }),
      ],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Order Processing');
    expect(container.textContent).toContain('completed successfully');
    expect(container.textContent).toContain('1.5s');
    expect(container.textContent).toContain('2 systems');
  });

  it('renders failure outcome', () => {
    const detail = makeTraceDetail({
      processName: 'order_processing',
      statusCounts: { SUCCESS: 2, FAILURE: 1 },
      events: [
        makeTraceEvent({ targetSystem: 'A' }),
        makeTraceEvent({ targetSystem: 'B', eventStatus: 'FAILURE' }),
      ],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('encountered 1 error');
  });

  it('renders multiple failures correctly', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 1, FAILURE: 3 },
      events: [makeTraceEvent({ targetSystem: 'A' })],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('encountered 3 errors');
  });

  it('renders in-progress outcome', () => {
    const detail = makeTraceDetail({
      statusCounts: { IN_PROGRESS: 2 },
      events: [makeTraceEvent({ targetSystem: 'A' })],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('is still in progress');
  });

  it('renders null duration as "unknown duration"', () => {
    const detail = makeTraceDetail({
      totalDurationMs: null,
      events: [makeTraceEvent({ targetSystem: 'A' })],
      statusCounts: { SUCCESS: 1 },
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('unknown duration');
  });

  it('renders ms duration for < 1000', () => {
    const detail = makeTraceDetail({
      totalDurationMs: 500,
      events: [makeTraceEvent({ targetSystem: 'A' })],
      statusCounts: { SUCCESS: 1 },
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('500ms');
  });

  it('renders minutes for >= 60000ms', () => {
    const detail = makeTraceDetail({
      totalDurationMs: 120000,
      events: [makeTraceEvent({ targetSystem: 'A' })],
      statusCounts: { SUCCESS: 1 },
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('2.0m');
  });

  it('renders "in parallel" when parallel execution detected', () => {
    (hasParallelExecution as any).mockReturnValue(true);

    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 2 },
      events: [
        makeTraceEvent({ targetSystem: 'A' }),
        makeTraceEvent({ targetSystem: 'B' }),
      ],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('in parallel');
    (hasParallelExecution as any).mockReturnValue(false);
  });

  it('renders system traversal with "then" for <= 3 systems', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 2 },
      events: [
        makeTraceEvent({ targetSystem: 'Alpha' }),
        makeTraceEvent({ targetSystem: 'Beta' }),
      ],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Alpha, then Beta');
  });

  it('renders system traversal with commas and "and" for > 3 systems', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 4 },
      events: [
        makeTraceEvent({ targetSystem: 'A' }),
        makeTraceEvent({ targetSystem: 'B' }),
        makeTraceEvent({ targetSystem: 'C' }),
        makeTraceEvent({ targetSystem: 'D' }),
      ],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('A, B, C, and D');
  });

  it('renders key identifiers from accountId', () => {
    const detail = makeTraceDetail({
      accountId: 'ACC-123',
      statusCounts: { SUCCESS: 1 },
      events: [makeTraceEvent({ targetSystem: 'A' })],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Account ACC-123');
  });

  it('renders identifiers from event identifiers object', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 1 },
      events: [
        makeTraceEvent({
          targetSystem: 'A',
          identifiers: { orderId: 'ORD-456', customerId: 'CUST-789' },
        }),
      ],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('order Id: ORD-456');
    expect(container.textContent).toContain('customer Id: CUST-789');
  });

  it('renders error events summary', () => {
    const detail = makeTraceDetail({
      statusCounts: { FAILURE: 1 },
      events: [
        makeTraceEvent({
          targetSystem: 'A',
          eventStatus: 'FAILURE',
          errorMessage: 'Connection timeout',
        }),
      ],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Error summary');
    expect(container.textContent).toContain('Connection timeout');
  });

  it('does not render error summary when no errors', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 1 },
      events: [makeTraceEvent({ targetSystem: 'A' })],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).not.toContain('Error summary');
  });
});
