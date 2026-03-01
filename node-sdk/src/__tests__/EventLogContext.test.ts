import { describe, it, expect, afterEach } from 'vitest';
import { EventLogContext, eventLogContext } from '../context/EventLogContext';
import { EventLogTemplate } from '../client/EventLogTemplate';
import { AsyncEventLogger } from '../client/AsyncEventLogger';
import { MockAsyncEventLogger } from '../testing/MockAsyncEventLogger';

describe('EventLogContext', () => {
  it('returns undefined outside of run()', () => {
    const ctx = new EventLogContext();
    expect(ctx.get()).toBeUndefined();
  });

  it('provides context inside run()', () => {
    const ctx = new EventLogContext();
    ctx.run({ correlationId: 'corr-1', traceId: 'trace-1' }, () => {
      const data = ctx.get();
      expect(data).toBeDefined();
      expect(data!.correlationId).toBe('corr-1');
      expect(data!.traceId).toBe('trace-1');
    });
  });

  it('context is unavailable after run() completes', () => {
    const ctx = new EventLogContext();
    ctx.run({ correlationId: 'corr-1' }, () => {
      // inside
    });
    expect(ctx.get()).toBeUndefined();
  });

  it('set() updates current context', () => {
    const ctx = new EventLogContext();
    ctx.run({ correlationId: 'corr-1' }, () => {
      ctx.set('traceId', 'trace-new');
      expect(ctx.get()!.traceId).toBe('trace-new');
    });
  });

  it('set() is a no-op outside run()', () => {
    const ctx = new EventLogContext();
    ctx.set('correlationId', 'value');
    expect(ctx.get()).toBeUndefined();
  });

  it('works with async/await', async () => {
    const ctx = new EventLogContext();
    await ctx.run({ correlationId: 'async-corr' }, async () => {
      await new Promise((r) => setTimeout(r, 10));
      expect(ctx.get()!.correlationId).toBe('async-corr');
    });
  });

  it('nested runs create independent scopes', () => {
    const ctx = new EventLogContext();
    ctx.run({ correlationId: 'outer' }, () => {
      expect(ctx.get()!.correlationId).toBe('outer');

      ctx.run({ correlationId: 'inner' }, () => {
        expect(ctx.get()!.correlationId).toBe('inner');
      });

      expect(ctx.get()!.correlationId).toBe('outer');
    });
  });
});

describe('eventLogContext singleton', () => {
  it('is an instance of EventLogContext', () => {
    expect(eventLogContext).toBeInstanceOf(EventLogContext);
  });
});

describe('ProcessLogger + EventLogContext integration', () => {
  let mock: MockAsyncEventLogger;

  afterEach(() => {
    mock?.reset();
  });

  it('auto-reads correlationId and traceId from context', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    eventLogContext.run(
      { correlationId: 'ctx-corr-123', traceId: 'ctx-trace-456' },
      () => {
        const process = template.forProcess('TestProcess');
        expect(process.correlationId).toBe('ctx-corr-123');
        expect(process.traceId).toBe('ctx-trace-456');

        process.logStart('Start');
        expect(mock.capturedEvents[0].correlation_id).toBe('ctx-corr-123');
        expect(mock.capturedEvents[0].trace_id).toBe('ctx-trace-456');
      }
    );
  });

  it('explicit config overrides context', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    eventLogContext.run(
      { correlationId: 'ctx-corr', traceId: 'ctx-trace' },
      () => {
        const process = template.forProcess('TestProcess', {
          correlationId: 'explicit-corr',
          traceId: 'explicit-trace',
        });
        expect(process.correlationId).toBe('explicit-corr');
        expect(process.traceId).toBe('explicit-trace');
      }
    );
  });

  it('auto-generates IDs when no context and no explicit config', () => {
    mock = new MockAsyncEventLogger();
    const template = new EventLogTemplate({
      logger: mock as unknown as AsyncEventLogger,
      applicationId: 'app',
      targetSystem: 'target',
      originatingSystem: 'origin',
    });

    // Outside any context
    const process = template.forProcess('TestProcess');
    expect(process.correlationId).toBeTruthy();
    expect(process.traceId).toBeTruthy();
    // Should be auto-generated format
    expect(process.correlationId).toMatch(/^corr-/);
  });
});
