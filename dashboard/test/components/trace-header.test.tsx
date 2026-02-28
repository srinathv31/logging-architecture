// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { makeTraceDetail } from '../util/fixtures';

vi.mock('@/lib/constants', () => ({
  STATUS_ICONS: {
    SUCCESS: (props: any) => <span data-testid="success-icon" {...props}>S</span>,
    FAILURE: (props: any) => <span data-testid="failure-icon" {...props}>F</span>,
    IN_PROGRESS: (props: any) => <span data-testid="inprogress-icon" {...props}>I</span>,
    SKIPPED: (props: any) => <span data-testid="skipped-icon" {...props}>K</span>,
    WARNING: (props: any) => <span data-testid="warning-icon" {...props}>W</span>,
  },
}));

import { TraceHeader } from '@/components/trace-detail/trace-header';

describe('TraceHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders process name formatted', () => {
    const detail = makeTraceDetail({
      processName: 'order_processing',
    });

    render(<TraceHeader traceId="trace-1" detail={detail} />);

    expect(screen.getByText('Order Processing')).toBeDefined();
  });

  it('renders traceId', () => {
    const detail = makeTraceDetail();

    const { container } = render(
      <TraceHeader traceId="my-trace-id" detail={detail} />
    );

    expect(container.textContent).toContain('my-trace-id');
  });

  it('renders event count', () => {
    const detail = makeTraceDetail();

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Events');
  });

  it('renders duration', () => {
    const detail = makeTraceDetail({ totalDurationMs: 2500 });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('2.5s');
    expect(container.textContent).toContain('Duration');
  });

  it('renders null duration as "-"', () => {
    const detail = makeTraceDetail({ totalDurationMs: null });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('-');
  });

  it('renders ms duration for < 1000', () => {
    const detail = makeTraceDetail({ totalDurationMs: 500 });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('500ms');
  });

  it('renders minutes for >= 60000ms', () => {
    const detail = makeTraceDetail({ totalDurationMs: 120000 });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('2.0m');
  });

  it('renders systems count', () => {
    const detail = makeTraceDetail({
      systemsInvolved: ['A', 'B', 'C'],
    });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('Systems');
  });

  it('renders status counts for each status', () => {
    const detail = makeTraceDetail({
      statusCounts: { SUCCESS: 5, FAILURE: 2, WARNING: 0, IN_PROGRESS: 1, SKIPPED: 0 },
    });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('SUCCESS');
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('FAILURE');
    expect(container.textContent).toContain('2');
  });

  it('renders systems involved as badges', () => {
    const detail = makeTraceDetail({
      systemsInvolved: ['Gateway', 'PaymentService'],
    });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Gateway');
    expect(container.textContent).toContain('PaymentService');
    expect(container.textContent).toContain('Systems Involved');
  });

  it('renders accountId when present', () => {
    const detail = makeTraceDetail({
      accountId: 'ACC-12345',
    });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Account:');
    expect(container.textContent).toContain('ACC-12345');
  });

  it('does not render accountId when null', () => {
    const detail = makeTraceDetail({
      accountId: null,
    });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).not.toContain('Account:');
  });

  it('renders time range when both startTime and endTime are present', () => {
    const detail = makeTraceDetail({
      startTime: '2025-01-01T10:00:00.000Z',
      endTime: '2025-01-01T10:00:05.000Z',
    });

    const { container } = render(
      <TraceHeader traceId="trace-1" detail={detail} />
    );

    expect(container.textContent).toContain('Started:');
    expect(container.textContent).toContain('Completed:');
  });

  it('copy button copies trace ID to clipboard', async () => {
    const detail = makeTraceDetail();

    render(<TraceHeader traceId="trace-to-copy" detail={detail} />);

    const copyButtons = screen.getAllByRole('button');
    const firstCopyBtn = copyButtons[0];

    await act(async () => {
      fireEvent.click(firstCopyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('trace-to-copy');
  });
});
