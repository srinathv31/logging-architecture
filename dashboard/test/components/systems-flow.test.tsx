// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

vi.mock('@/lib/span-tree', () => ({
  buildSystemFlow: vi.fn().mockReturnValue([]),
}));

import { SystemsFlow } from '@/components/trace-detail/systems-flow';
import { buildSystemFlow } from '@/lib/span-tree';

describe('SystemsFlow', () => {
  it('returns null when flow is empty', () => {
    (buildSystemFlow as any).mockReturnValue([]);

    const events = [makeTraceEvent({ targetSystem: 'A' })];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders system journey header', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['Gateway'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('System Journey');
  });

  it('renders single system node', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['Gateway'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('Gateway');
    expect(container.textContent).toContain('1 event');
  });

  it('renders multiple events as plural', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['Gateway'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 50 }),
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 50 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('2 events');
  });

  it('renders execution time for system', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['Gateway'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 500 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('500ms');
  });

  it('renders parallel systems in column layout', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['ServiceA', 'ServiceB'], isParallel: true },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'ServiceA', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
      makeTraceEvent({ targetSystem: 'ServiceB', eventStatus: 'FAILURE', executionTimeMs: 200 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('ServiceA');
    expect(container.textContent).toContain('ServiceB');
  });

  it('handles failure status on a system', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['FailedService'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'FailedService', eventStatus: 'FAILURE', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('FailedService');
  });

  it('handles in-progress status on a system', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['SlowService'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'SlowService', eventStatus: 'IN_PROGRESS', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('SlowService');
  });

  it('renders seconds for time >= 1000ms', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['Gateway'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 2500 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('2.5s');
  });

  it('renders sequential flow with arrows', () => {
    (buildSystemFlow as any).mockReturnValue([
      { systems: ['A'], isParallel: false },
      { systems: ['B'], isParallel: false },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'A', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
      makeTraceEvent({ targetSystem: 'B', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('B');
    // SVG arrows should be present
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
