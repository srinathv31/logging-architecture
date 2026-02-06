import { describe, it, expect } from 'vitest';
import { buildSpanTree, hasParallelExecution, buildSystemFlow } from '@/lib/span-tree';
import type { TraceEvent } from '@/data/queries';

function makeEvent(overrides: Partial<TraceEvent> & { eventLogId: number; targetSystem: string }): TraceEvent {
  return {
    executionId: 'exec-1',
    correlationId: 'corr-1',
    accountId: null,
    traceId: 'trace-1',
    spanId: null,
    parentSpanId: null,
    batchId: null,
    applicationId: 'app-1',
    originatingSystem: 'origin',
    processName: 'test-process',
    stepSequence: null,
    stepName: null,
    eventType: 'API_CALL',
    eventStatus: 'SUCCESS',
    identifiers: null,
    summary: 'test event',
    result: 'OK',
    metadata: null,
    eventTimestamp: '2025-01-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    executionTimeMs: null,
    endpoint: null,
    httpStatusCode: null,
    httpMethod: null,
    errorCode: null,
    errorMessage: null,
    requestPayload: null,
    responsePayload: null,
    ...overrides,
  };
}

describe('buildSpanTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildSpanTree([])).toEqual([]);
  });

  it('returns all sequential entries when no events share parentSpanId + stepSequence', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', stepSequence: 2 }),
      makeEvent({ eventLogId: 3, targetSystem: 'SystemC', stepSequence: 3 }),
    ];

    const timeline = buildSpanTree(events);

    expect(timeline).toHaveLength(3);
    expect(timeline.every((e) => e.type === 'sequential')).toBe(true);
    expect(timeline.map((e) => e.events[0].targetSystem)).toEqual(['SystemA', 'SystemB', 'SystemC']);
  });

  it('groups parallel siblings sharing the same parentSpanId and stepSequence', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', parentSpanId: 'span-1', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', parentSpanId: 'span-1', stepSequence: 1 }),
      makeEvent({ eventLogId: 3, targetSystem: 'SystemC', parentSpanId: 'span-1', stepSequence: 1 }),
    ];

    const timeline = buildSpanTree(events);

    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('parallel');
    expect(timeline[0].events).toHaveLength(3);
  });

  it('handles mixed sequential and parallel events', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', parentSpanId: 'span-1', stepSequence: 2 }),
      makeEvent({ eventLogId: 3, targetSystem: 'SystemC', parentSpanId: 'span-1', stepSequence: 2 }),
      makeEvent({ eventLogId: 4, targetSystem: 'SystemD', stepSequence: 3 }),
    ];

    const timeline = buildSpanTree(events);

    expect(timeline).toHaveLength(3);
    expect(timeline[0].type).toBe('sequential');
    expect(timeline[0].events[0].targetSystem).toBe('SystemA');
    expect(timeline[1].type).toBe('parallel');
    expect(timeline[1].events).toHaveLength(2);
    expect(timeline[2].type).toBe('sequential');
    expect(timeline[2].events[0].targetSystem).toBe('SystemD');
  });

  it('treats events with same parentSpanId but different stepSequence as separate', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', parentSpanId: 'span-1', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', parentSpanId: 'span-1', stepSequence: 2 }),
    ];

    const timeline = buildSpanTree(events);

    expect(timeline).toHaveLength(2);
    expect(timeline.every((e) => e.type === 'sequential')).toBe(true);
  });

  it('treats events without parentSpanId as ungrouped/sequential', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', parentSpanId: null, stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', parentSpanId: null, stepSequence: 1 }),
    ];

    const timeline = buildSpanTree(events);

    expect(timeline).toHaveLength(2);
    expect(timeline.every((e) => e.type === 'sequential')).toBe(true);
  });
});

describe('hasParallelExecution', () => {
  it('returns false for empty events', () => {
    expect(hasParallelExecution([])).toBe(false);
  });

  it('returns false when all events are sequential', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', stepSequence: 2 }),
    ];

    expect(hasParallelExecution(events)).toBe(false);
  });

  it('returns true when parallel groups exist', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', parentSpanId: 'span-1', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', parentSpanId: 'span-1', stepSequence: 1 }),
    ];

    expect(hasParallelExecution(events)).toBe(true);
  });
});

describe('buildSystemFlow', () => {
  it('returns empty array for empty events', () => {
    expect(buildSystemFlow([])).toEqual([]);
  });

  it('builds sequential flow nodes for sequential events', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', stepSequence: 2 }),
      makeEvent({ eventLogId: 3, targetSystem: 'SystemC', stepSequence: 3 }),
    ];

    const flow = buildSystemFlow(events);

    expect(flow).toHaveLength(3);
    expect(flow[0]).toEqual({ systems: ['SystemA'], isParallel: false });
    expect(flow[1]).toEqual({ systems: ['SystemB'], isParallel: false });
    expect(flow[2]).toEqual({ systems: ['SystemC'], isParallel: false });
  });

  it('groups parallel systems together', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', parentSpanId: 'span-1', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemB', parentSpanId: 'span-1', stepSequence: 1 }),
    ];

    const flow = buildSystemFlow(events);

    expect(flow).toHaveLength(1);
    expect(flow[0].isParallel).toBe(true);
    expect(flow[0].systems).toContain('SystemA');
    expect(flow[0].systems).toContain('SystemB');
  });

  it('deduplicates already-seen systems', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemA', stepSequence: 2 }),
      makeEvent({ eventLogId: 3, targetSystem: 'SystemB', stepSequence: 3 }),
    ];

    const flow = buildSystemFlow(events);

    expect(flow).toHaveLength(2);
    expect(flow[0]).toEqual({ systems: ['SystemA'], isParallel: false });
    expect(flow[1]).toEqual({ systems: ['SystemB'], isParallel: false });
  });

  it('deduplicates systems across parallel groups', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'SystemA', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'SystemA', parentSpanId: 'span-1', stepSequence: 2 }),
      makeEvent({ eventLogId: 3, targetSystem: 'SystemB', parentSpanId: 'span-1', stepSequence: 2 }),
    ];

    const flow = buildSystemFlow(events);

    expect(flow).toHaveLength(2);
    expect(flow[0]).toEqual({ systems: ['SystemA'], isParallel: false });
    // SystemA is already seen, so only SystemB remains in the parallel group
    expect(flow[1]).toEqual({ systems: ['SystemB'], isParallel: true });
  });

  it('handles mixed sequential and parallel with deduplication', () => {
    const events = [
      makeEvent({ eventLogId: 1, targetSystem: 'Gateway', stepSequence: 1 }),
      makeEvent({ eventLogId: 2, targetSystem: 'ServiceA', parentSpanId: 'span-1', stepSequence: 2 }),
      makeEvent({ eventLogId: 3, targetSystem: 'ServiceB', parentSpanId: 'span-1', stepSequence: 2 }),
      makeEvent({ eventLogId: 4, targetSystem: 'Database', stepSequence: 3 }),
    ];

    const flow = buildSystemFlow(events);

    expect(flow).toHaveLength(3);
    expect(flow[0]).toEqual({ systems: ['Gateway'], isParallel: false });
    expect(flow[1].isParallel).toBe(true);
    expect(flow[1].systems).toEqual(expect.arrayContaining(['ServiceA', 'ServiceB']));
    expect(flow[2]).toEqual({ systems: ['Database'], isParallel: false });
  });
});
