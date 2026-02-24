// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

vi.mock('@/lib/constants', () => ({
  STATUS_ICONS: {
    SUCCESS: (props: any) => <span {...props}>S</span>,
    FAILURE: (props: any) => <span {...props}>F</span>,
    IN_PROGRESS: (props: any) => <span {...props}>I</span>,
  },
  STATUS_ICON_COLORS: {},
  STATUS_BG_COLORS: {},
  STATUS_RING_COLORS: {},
  EVENT_TYPE_COLORS: { API_CALL: '', STEP: '' },
  EVENT_TYPE_ICONS: {
    API_CALL: (props: any) => <span {...props}>ETI</span>,
    STEP: (props: any) => <span {...props}>STI</span>,
  },
  HTTP_METHOD_COLORS: {},
}));

vi.mock('@/components/trace-detail/event-log-steps', () => ({
  EventLogSteps: () => <span data-testid="event-log-steps" />,
}));

import { RetryGroup } from '@/components/trace-detail/retry-group';

describe('RetryGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const firstTimestamp = new Date('2025-01-01T00:00:00.000Z').getTime();

  it('renders "Step Retry" label', () => {
    const events = [makeTraceEvent({ eventTimestamp: '2025-01-01T00:00:00.000Z' })];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    expect(container.textContent).toContain('Step Retry');
  });

  it('labels each event as "Attempt N"', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventStatus: 'FAILURE', eventTimestamp: '2025-01-01T00:00:00.000Z' }),
      makeTraceEvent({ eventLogId: 2, eventStatus: 'SUCCESS', eventTimestamp: '2025-01-01T00:00:01.000Z' }),
    ];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    expect(container.textContent).toContain('Attempt 1');
    expect(container.textContent).toContain('Attempt 2');
  });

  it('dims failed non-final attempts (opacity-60)', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventStatus: 'FAILURE', eventTimestamp: '2025-01-01T00:00:00.000Z' }),
      makeTraceEvent({ eventLogId: 2, eventStatus: 'SUCCESS', eventTimestamp: '2025-01-01T00:00:01.000Z' }),
    ];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    const cards = container.querySelectorAll('.animate-fade-in');
    // First card (failed, non-final) should have opacity-60
    expect(cards[0].className).toContain('opacity-60');
    // Second card (final) should not
    expect(cards[1].className).not.toContain('opacity-60');
  });

  it('shows red ring on failed attempts', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventStatus: 'FAILURE', eventTimestamp: '2025-01-01T00:00:00.000Z' }),
      makeTraceEvent({ eventLogId: 2, eventStatus: 'SUCCESS', eventTimestamp: '2025-01-01T00:00:01.000Z' }),
    ];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    const redRing = container.querySelector('.ring-red-500\\/30');
    expect(redRing).not.toBeNull();
  });

  it('shows "Resolved" when last event is SUCCESS', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventStatus: 'FAILURE', eventTimestamp: '2025-01-01T00:00:00.000Z' }),
      makeTraceEvent({ eventLogId: 2, eventStatus: 'SUCCESS', eventTimestamp: '2025-01-01T00:00:01.000Z' }),
    ];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    expect(container.textContent).toContain('Resolved');
  });

  it('shows "Retrying" when last event is not SUCCESS', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventStatus: 'FAILURE', eventTimestamp: '2025-01-01T00:00:00.000Z' }),
      makeTraceEvent({ eventLogId: 2, eventStatus: 'FAILURE', eventTimestamp: '2025-01-01T00:00:01.000Z' }),
    ];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    expect(container.textContent).toContain('Retrying');
  });

  it('shows time diff badge when offset from firstTimestamp', () => {
    const events = [
      makeTraceEvent({ eventTimestamp: '2025-01-01T00:00:03.000Z' }),
    ];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    expect(container.textContent).toContain('+3.0s');
  });

  it('hides time diff badge when timeDiff is 0', () => {
    const events = [
      makeTraceEvent({ eventTimestamp: '2025-01-01T00:00:00.000Z' }),
    ];
    const { container } = render(<RetryGroup events={events} firstTimestamp={firstTimestamp} />);
    expect(container.textContent).not.toContain('+0');
  });
});
