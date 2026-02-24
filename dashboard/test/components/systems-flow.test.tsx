// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { makeTraceEvent } from '../util/fixtures';

vi.mock('@/lib/span-tree', () => ({
  buildStepFlow: vi.fn().mockReturnValue([]),
}));

import { SystemsFlow } from '@/components/trace-detail/systems-flow';
import { buildStepFlow } from '@/lib/span-tree';

function makeStep(overrides: Partial<{ stepName: string | null; stepSequence: number | null; eventType: string; eventStatus: string; processName: string; targetSystem: string; executionTimeMs: number | null }> = {}) {
  return {
    stepName: 'init',
    stepSequence: 1,
    eventType: 'API_CALL',
    eventStatus: 'SUCCESS',
    processName: 'test-process',
    targetSystem: 'Gateway',
    executionTimeMs: 100,
    ...overrides,
  };
}

describe('SystemsFlow', () => {
  it('returns null when flow is empty', () => {
    (buildStepFlow as any).mockReturnValue([]);

    const events = [makeTraceEvent({ targetSystem: 'A' })];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders system journey header', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'Gateway' })] },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('System Journey');
  });

  it('renders single step node', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'Gateway', stepName: 'init' })] },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('Gateway');
    expect(container.textContent).toContain('init');
  });

  it('renders multiple sequential steps', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'Gateway', stepName: 'receive' })] },
      { type: 'sequential', steps: [makeStep({ targetSystem: 'Service', stepName: 'process' })] },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 50 }),
      makeTraceEvent({ targetSystem: 'Service', eventStatus: 'SUCCESS', executionTimeMs: 50 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('Gateway');
    expect(container.textContent).toContain('Service');
  });

  it('renders execution time for step', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'Gateway', executionTimeMs: 500 })] },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 500 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('500ms');
  });

  it('renders parallel steps in column layout', () => {
    (buildStepFlow as any).mockReturnValue([
      {
        type: 'parallel',
        steps: [
          makeStep({ targetSystem: 'ServiceA', stepName: 'callA', eventStatus: 'SUCCESS' }),
          makeStep({ targetSystem: 'ServiceB', stepName: 'callB', eventStatus: 'FAILURE' }),
        ],
      },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'ServiceA', eventStatus: 'SUCCESS', executionTimeMs: 100 }),
      makeTraceEvent({ targetSystem: 'ServiceB', eventStatus: 'FAILURE', executionTimeMs: 200 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('ServiceA');
    expect(container.textContent).toContain('ServiceB');
  });

  it('handles failure status on a step', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'FailedService', eventStatus: 'FAILURE' })] },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'FailedService', eventStatus: 'FAILURE', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('FailedService');
  });

  it('handles in-progress status on a step', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'SlowService', eventStatus: 'IN_PROGRESS' })] },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'SlowService', eventStatus: 'IN_PROGRESS', executionTimeMs: 100 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('SlowService');
  });

  it('renders seconds for time >= 1000ms', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'Gateway', executionTimeMs: 2500 })] },
    ]);

    const events = [
      makeTraceEvent({ targetSystem: 'Gateway', eventStatus: 'SUCCESS', executionTimeMs: 2500 }),
    ];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('2.5s');
  });

  it('renders sequential flow with arrows', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'A', stepName: 'stepA' })] },
      { type: 'sequential', steps: [makeStep({ targetSystem: 'B', stepName: 'stepB' })] },
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

  it('renders retry group with attempts badge and dashed border', () => {
    (buildStepFlow as any).mockReturnValue([
      {
        type: 'retry',
        steps: [
          makeStep({ targetSystem: 'A', stepName: 'Validate', eventStatus: 'FAILURE', executionTimeMs: 50 }),
          makeStep({ targetSystem: 'A', stepName: 'Validate', eventStatus: 'SUCCESS', executionTimeMs: 80 }),
        ],
      },
    ]);

    const events = [makeTraceEvent()];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('2 attempts');
    expect(container.querySelector('.border-dashed')).not.toBeNull();
  });

  it('shows only final attempt step in retry node', () => {
    (buildStepFlow as any).mockReturnValue([
      {
        type: 'retry',
        steps: [
          makeStep({ targetSystem: 'A', stepName: 'Validate', eventStatus: 'FAILURE' }),
          makeStep({ targetSystem: 'A', stepName: 'Validate', eventStatus: 'SUCCESS' }),
        ],
      },
    ]);

    const events = [makeTraceEvent()];
    const { container } = render(<SystemsFlow events={events} />);

    // The StepNodeCard for the retry renders only the last step
    const successNodes = container.querySelectorAll('[class*="text-green-500"]');
    expect(successNodes.length).toBeGreaterThan(0);
  });

  it('renders parallel group with fork and join arrows between nodes', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ targetSystem: 'A', stepName: 'Start' })] },
      {
        type: 'parallel',
        steps: [
          makeStep({ targetSystem: 'B', stepName: 'ParA' }),
          makeStep({ targetSystem: 'C', stepName: 'ParB' }),
        ],
      },
      { type: 'sequential', steps: [makeStep({ targetSystem: 'D', stepName: 'End' })] },
    ]);

    const events = [makeTraceEvent()];
    const { container } = render(<SystemsFlow events={events} />);

    // Should have ForkArrows + JoinArrows SVGs (at least 3 SVGs total: Arrow, Fork, Join)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
    expect(container.textContent).toContain('ParA');
    expect(container.textContent).toContain('ParB');
  });

  it('renders "(across all attempts)" when retryInfo is provided', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep()] },
    ]);

    const retryInfo = {
      attempts: [{ attemptNumber: 1, rootSpanId: null, events: [], status: 'success' as const }],
      finalAttempt: { attemptNumber: 1, rootSpanId: null, events: [], status: 'success' as const },
      overallStatus: 'success' as const,
    };

    const events = [makeTraceEvent()];
    const { container } = render(<SystemsFlow events={events} retryInfo={retryInfo} />);
    expect(container.textContent).toContain('(across all attempts)');
  });

  it('falls back to processName when stepName is null', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ stepName: null, processName: 'my-fallback' })] },
    ]);

    const events = [makeTraceEvent()];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('my-fallback');
  });

  it('hides execution time when 0', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ executionTimeMs: 0 })] },
    ]);

    const events = [makeTraceEvent()];
    const { container } = render(<SystemsFlow events={events} />);

    // formatMs returns "" for ms <= 0, so no time text
    expect(container.textContent).not.toContain('ms');
    expect(container.textContent).not.toContain('0s');
  });

  it('renders minutes for large execution time', () => {
    (buildStepFlow as any).mockReturnValue([
      { type: 'sequential', steps: [makeStep({ executionTimeMs: 120000 })] },
    ]);

    const events = [makeTraceEvent()];
    const { container } = render(<SystemsFlow events={events} />);

    expect(container.textContent).toContain('2.0m');
  });
});
