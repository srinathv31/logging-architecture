// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { makeTraceEvent, makeTraceDetail } from '../util/fixtures';

vi.mock('@/lib/span-tree', () => ({
  hasParallelExecution: vi.fn().mockReturnValue(false),
  buildStepFlow: vi.fn().mockReturnValue([]),
}));

import { JourneyNarrative } from '@/components/trace-detail/journey-narrative';
import { hasParallelExecution, buildStepFlow } from '@/lib/span-tree';

describe('JourneyNarrative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hasParallelExecution as any).mockReturnValue(false);
    (buildStepFlow as any).mockReturnValue([]);
  });

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

  it('renders retry success narrative with retryInfo', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 1 },
      events: [makeTraceEvent({ targetSystem: 'A' })],
    });
    const retryInfo = {
      attempts: [
        { attemptNumber: 1, rootSpanId: null, events: [], status: 'failure' as const },
        { attemptNumber: 2, rootSpanId: null, events: [], status: 'success' as const },
      ],
      finalAttempt: { attemptNumber: 2, rootSpanId: null, events: [], status: 'success' as const },
      overallStatus: 'success' as const,
    };
    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} retryInfo={retryInfo} />
    );
    expect(container.textContent).toContain('failed on the first attempt, then retried and completed successfully');
    expect(container.textContent).toContain('Completed in');
    expect(container.textContent).toContain('2 attempts');
  });

  it('renders retry failure narrative', () => {
    const detail = makeTraceDetail({
      statusCounts: { FAILURE: 1 },
      events: [makeTraceEvent({ targetSystem: 'A', eventStatus: 'FAILURE' })],
    });
    const retryInfo = {
      attempts: [
        { attemptNumber: 1, rootSpanId: null, events: [], status: 'failure' as const },
        { attemptNumber: 2, rootSpanId: null, events: [], status: 'failure' as const },
        { attemptNumber: 3, rootSpanId: null, events: [], status: 'failure' as const },
      ],
      finalAttempt: { attemptNumber: 3, rootSpanId: null, events: [], status: 'failure' as const },
      overallStatus: 'failure' as const,
    };
    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} retryInfo={retryInfo} />
    );
    expect(container.textContent).toContain('failed after 3 attempts');
  });

  it('renders retry in-progress narrative', () => {
    const detail = makeTraceDetail({
      statusCounts: { IN_PROGRESS: 1 },
      events: [makeTraceEvent({ targetSystem: 'A' })],
    });
    const retryInfo = {
      attempts: [
        { attemptNumber: 1, rootSpanId: null, events: [], status: 'failure' as const },
        { attemptNumber: 2, rootSpanId: null, events: [], status: 'in_progress' as const },
      ],
      finalAttempt: { attemptNumber: 2, rootSpanId: null, events: [], status: 'in_progress' as const },
      overallStatus: 'in_progress' as const,
    };
    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} retryInfo={retryInfo} />
    );
    expect(container.textContent).toContain('retry attempt 2 is in progress');
  });

  it('renders step-level retry note when buildStepFlow returns retry nodes and no retryInfo', () => {
    (buildStepFlow as any).mockReturnValue([
      {
        type: 'retry',
        steps: [
          { stepName: 'Validate', stepSequence: 1, eventType: 'STEP', eventStatus: 'FAILURE', processName: 'p', targetSystem: 'A', executionTimeMs: null },
          { stepName: 'Validate', stepSequence: 1, eventType: 'STEP', eventStatus: 'SUCCESS', processName: 'p', targetSystem: 'A', executionTimeMs: null },
        ],
      },
    ]);

    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 1 },
      events: [makeTraceEvent({ targetSystem: 'A', eventType: 'PROCESS_END', eventStatus: 'SUCCESS' })],
    });

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} />
    );
    expect(container.textContent).toContain('required');
    expect(container.textContent).toContain('retries');
    expect(container.textContent).toContain('and resolved successfully');
  });

  it('error callout uses amber theme when retryInfo.overallStatus is success', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 1 },
      events: [
        makeTraceEvent({
          targetSystem: 'A',
          eventStatus: 'SUCCESS',
          errorMessage: 'Transient error',
          eventType: 'PROCESS_END',
        }),
      ],
    });
    const retryInfo = {
      attempts: [
        { attemptNumber: 1, rootSpanId: null, events: [], status: 'failure' as const },
        { attemptNumber: 2, rootSpanId: null, events: [], status: 'success' as const },
      ],
      finalAttempt: { attemptNumber: 2, rootSpanId: null, events: [], status: 'success' as const },
      overallStatus: 'success' as const,
    };

    const { container } = render(
      <JourneyNarrative traceId="trace-1" detail={detail} retryInfo={retryInfo} />
    );
    expect(container.querySelector('.border-amber-200')).not.toBeNull();
    expect(container.textContent).toContain('Errors from earlier attempt(s)');
  });
});
