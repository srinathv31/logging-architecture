// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

import { DurationBreakdown } from '@/components/trace-detail/duration-breakdown';

describe('DurationBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for empty events', () => {
    const { container } = render(<DurationBreakdown events={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when only PROCESS_START/PROCESS_END events', () => {
    const events = [
      makeTraceEvent({ eventType: 'PROCESS_START', eventTimestamp: '2025-01-01T00:00:00.000Z' }),
      makeTraceEvent({ eventType: 'PROCESS_END', eventLogId: 2, eventTimestamp: '2025-01-01T00:00:01.000Z' }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders "Duration Breakdown" heading', () => {
    const events = [
      makeTraceEvent({ eventType: 'STEP', stepName: 'Validate', stepSequence: 1, eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: 100 }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    expect(container.textContent).toContain('Duration Breakdown');
  });

  it('renders bar segments for each step', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventType: 'STEP', stepName: 'Validate', stepSequence: 1, eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: 100 }),
      makeTraceEvent({ eventLogId: 2, eventType: 'STEP', stepName: 'Process', stepSequence: 2, eventTimestamp: '2025-01-01T00:00:01.000Z', executionTimeMs: 200 }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    // There should be segments with width styling
    const segments = container.querySelectorAll('[style*="width"]');
    expect(segments.length).toBe(2);
  });

  it('merges consecutive events with same step identity', () => {
    const events = [
      makeTraceEvent({
        eventLogId: 1, eventType: 'STEP', stepName: 'Validate', stepSequence: 1,
        parentSpanId: 'span-1', eventStatus: 'IN_PROGRESS',
        eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: null,
      }),
      makeTraceEvent({
        eventLogId: 2, eventType: 'STEP', stepName: 'Validate', stepSequence: 1,
        parentSpanId: 'span-1', eventStatus: 'SUCCESS',
        eventTimestamp: '2025-01-01T00:00:00.500Z', executionTimeMs: 500,
      }),
      makeTraceEvent({
        eventLogId: 3, eventType: 'STEP', stepName: 'Process', stepSequence: 2,
        parentSpanId: 'span-1', eventStatus: 'SUCCESS',
        eventTimestamp: '2025-01-01T00:00:01.000Z', executionTimeMs: 300,
      }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    // Should have 2 segments (merged Validate + Process), not 3
    const segments = container.querySelectorAll('[style*="width"]');
    expect(segments.length).toBe(2);
  });

  it('uses executionTimeMs when available', () => {
    const events = [
      makeTraceEvent({
        eventLogId: 1, eventType: 'STEP', stepName: 'Fast Step', stepSequence: 1,
        eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: 50,
      }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    expect(container.textContent).toContain('50ms');
  });

  it('falls back to timestamp gaps when executionTimeMs is null', () => {
    const events = [
      makeTraceEvent({
        eventLogId: 1, eventType: 'STEP', stepName: 'Step A', stepSequence: 1,
        eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: null,
      }),
      makeTraceEvent({
        eventLogId: 2, eventType: 'STEP', stepName: 'Step B', stepSequence: 2,
        eventTimestamp: '2025-01-01T00:00:02.000Z', executionTimeMs: null,
      }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    // Step A duration = gap to Step B = 2000ms = 2.0s
    expect(container.textContent).toContain('2.0s');
  });

  it('shows legend entries with color dots', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventType: 'STEP', stepName: 'Validate', stepSequence: 1, eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: 100 }),
      makeTraceEvent({ eventLogId: 2, eventType: 'STEP', stepName: 'Process', stepSequence: 2, eventTimestamp: '2025-01-01T00:00:01.000Z', executionTimeMs: 200 }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    // Legend dots
    const dots = container.querySelectorAll('.rounded-sm');
    expect(dots.length).toBe(2);
    expect(container.textContent).toContain('Validate');
    expect(container.textContent).toContain('Process');
  });

  it('enforces minimum bar width of 2% for tiny segments', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventType: 'STEP', stepName: 'Tiny', stepSequence: 1, eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: 1 }),
      makeTraceEvent({ eventLogId: 2, eventType: 'STEP', stepName: 'Huge', stepSequence: 2, eventTimestamp: '2025-01-01T00:00:00.001Z', executionTimeMs: 10000 }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    const segments = container.querySelectorAll('[style*="width"]');
    // The tiny segment should have at least 2%
    const tinySegment = segments[0] as HTMLElement;
    expect(tinySegment.style.width).toBe('2%');
  });

  it('labels visible inside bar only when percentage > 12', () => {
    const events = [
      makeTraceEvent({ eventLogId: 1, eventType: 'STEP', stepName: 'Big Step', stepSequence: 1, eventTimestamp: '2025-01-01T00:00:00.000Z', executionTimeMs: 9000 }),
      makeTraceEvent({ eventLogId: 2, eventType: 'STEP', stepName: 'Small', stepSequence: 2, eventTimestamp: '2025-01-01T00:00:09.000Z', executionTimeMs: 100 }),
    ];
    const { container } = render(<DurationBreakdown events={events} />);
    // Big Step is ~99% — label should be visible inside bar
    const segments = container.querySelectorAll('[style*="width"]');
    const bigSegment = segments[0] as HTMLElement;
    expect(bigSegment.textContent).toContain('Big Step');
    // Small is ~1% — no label inside bar
    const smallSegment = segments[1] as HTMLElement;
    expect(smallSegment.textContent).toBe('');
  });
});
