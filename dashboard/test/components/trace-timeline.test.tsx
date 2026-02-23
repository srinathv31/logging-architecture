// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

vi.mock('@/lib/span-tree', () => ({
  buildSpanTree: vi.fn().mockReturnValue([]),
  buildStepFlow: vi.fn().mockReturnValue([]),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('nuqs', () => ({
  useQueryState: () => [null, vi.fn()],
  parseAsString: { withDefault: () => ({ withOptions: () => ({}) }) },
}));

import { TraceTimeline } from '@/components/trace-detail/trace-timeline';
import { buildSpanTree } from '@/lib/span-tree';

describe('TraceTimeline', () => {
  it('renders "Event Timeline" header', () => {
    (buildSpanTree as any).mockReturnValue([]);

    const events = [makeTraceEvent()];
    const { container } = render(<TraceTimeline events={events} />);

    expect(container.textContent).toContain('Event Timeline');
  });

  it('renders event count badge', () => {
    (buildSpanTree as any).mockReturnValue([]);

    const events = [makeTraceEvent(), makeTraceEvent({ eventLogId: 2 })];
    const { container } = render(<TraceTimeline events={events} />);

    expect(container.textContent).toContain('2 events');
  });

  it('renders sequential events', () => {
    const evt = makeTraceEvent({
      eventLogId: 1,
      stepName: 'Init Step',
      eventTimestamp: '2025-01-01T00:00:01.000Z',
    });

    (buildSpanTree as any).mockReturnValue([
      { type: 'sequential', events: [evt] },
    ]);

    const { container } = render(
      <TraceTimeline events={[evt]} />
    );

    expect(container.textContent).toContain('Init Step');
  });

  it('renders parallel group entries', () => {
    const evt1 = makeTraceEvent({ eventLogId: 1, stepName: 'ParA', eventTimestamp: '2025-01-01T00:00:01.000Z' });
    const evt2 = makeTraceEvent({ eventLogId: 2, stepName: 'ParB', eventTimestamp: '2025-01-01T00:00:01.000Z' });

    (buildSpanTree as any).mockReturnValue([
      { type: 'parallel', events: [evt1, evt2] },
    ]);

    const { container } = render(
      <TraceTimeline events={[evt1, evt2]} />
    );

    expect(container.textContent).toContain('Parallel Execution');
    expect(container.textContent).toContain('ParA');
    expect(container.textContent).toContain('ParB');
  });

  it('renders time diff for non-first events', () => {
    const evt1 = makeTraceEvent({ eventLogId: 1, eventTimestamp: '2025-01-01T00:00:00.000Z' });
    const evt2 = makeTraceEvent({ eventLogId: 2, eventTimestamp: '2025-01-01T00:00:05.000Z' });

    (buildSpanTree as any).mockReturnValue([
      { type: 'sequential', events: [evt1] },
      { type: 'sequential', events: [evt2] },
    ]);

    const { container } = render(
      <TraceTimeline events={[evt1, evt2]} />
    );

    expect(container.textContent).toContain('+5.0s');
  });
});
