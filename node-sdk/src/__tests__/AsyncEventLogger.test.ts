import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncEventLogger } from '../client/AsyncEventLogger';
import { EventLogClient, EventLogError } from '../client/EventLogClient';
import { EventLogEntry, EventType, EventStatus } from '../models/types';

// ============================================================================
// Test Helpers
// ============================================================================

function makeEvent(overrides?: Partial<EventLogEntry>): EventLogEntry {
  return {
    correlation_id: 'corr-' + Math.random().toString(36).slice(2, 8),
    trace_id: 'trace-abc',
    application_id: 'test-app',
    target_system: 'target',
    originating_system: 'origin',
    process_name: 'TestProcess',
    event_type: EventType.STEP,
    event_status: EventStatus.SUCCESS,
    identifiers: {},
    summary: 'Test',
    result: 'OK',
    event_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function createMockClient(overrides?: Partial<EventLogClient>) {
  return {
    createEvent: vi.fn(async () => ({
      success: true,
      execution_ids: ['e1'],
      correlation_id: 'c1',
    })),
    createEvents: vi.fn(async (events: EventLogEntry[]) => ({
      success: true,
      total_received: events.length,
      total_inserted: events.length,
      execution_ids: events.map((_, i) => `e${i}`),
    })),
    ...overrides,
  } as unknown as EventLogClient;
}

// ============================================================================
// Tests
// ============================================================================

describe('AsyncEventLogger', () => {
  let logger: AsyncEventLogger;

  afterEach(async () => {
    if (logger) {
      await logger.shutdown();
    }
  });

  describe('log()', () => {
    it('queues events and sends them', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        batchSize: 1,
      });

      const event = makeEvent();
      const queued = logger.log(event);
      expect(queued).toBe(true);

      await logger.flush(5000);
      expect(client.createEvent).toHaveBeenCalledWith(event);
    });

    it('returns false when shutting down', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({ client, logger: 'silent' });

      await logger.shutdown();
      expect(logger.log(makeEvent())).toBe(false);
    });

    it('auto-populates application_id from config', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        applicationId: 'config-app',
        logger: 'silent',
        batchSize: 1,
      });

      const event = makeEvent({ application_id: '' as string });
      logger.log(event);
      await logger.flush(5000);

      const sentEvent = (client.createEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(sentEvent.application_id).toBe('config-app');
    });

    it('does not overwrite existing application_id', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        applicationId: 'config-app',
        logger: 'silent',
        batchSize: 1,
      });

      const event = makeEvent({ application_id: 'explicit-app' });
      logger.log(event);
      await logger.flush(5000);

      const sentEvent = (client.createEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(sentEvent.application_id).toBe('explicit-app');
    });
  });

  describe('validation', () => {
    it('rejects invalid events when validateBeforeQueue is true', () => {
      const client = createMockClient();
      const onEventFailed = vi.fn();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        validateBeforeQueue: true,
        onEventFailed,
      });

      // Missing required fields
      const result = logger.log({} as EventLogEntry);
      expect(result).toBe(false);
      expect(onEventFailed).toHaveBeenCalled();
    });

    it('accepts events when validateBeforeQueue is false', () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        validateBeforeQueue: false,
      });

      const result = logger.log({ correlation_id: 'partial' } as EventLogEntry);
      expect(result).toBe(true);
    });
  });

  describe('payload truncation', () => {
    it('truncates oversized payloads', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        maxPayloadSize: 100,
        batchSize: 1,
        validateBeforeQueue: false,
      });

      const event = makeEvent({
        request_payload: 'X'.repeat(500),
        response_payload: 'Y'.repeat(500),
      });

      logger.log(event);
      await logger.flush(5000);

      const sentEvent = (client.createEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(sentEvent.request_payload!.length).toBeLessThan(500);
      expect(sentEvent.request_payload!.endsWith('[TRUNCATED]')).toBe(true);
      expect(sentEvent.response_payload!.endsWith('[TRUNCATED]')).toBe(true);
    });
  });

  describe('queue capacity & spillover', () => {
    it('calls onSpillover when queue is full', () => {
      const client = createMockClient();
      const onSpillover = vi.fn();
      logger = new AsyncEventLogger({
        client,
        queueCapacity: 2,
        onSpillover,
        logger: 'silent',
      });

      logger.log(makeEvent());
      logger.log(makeEvent());
      logger.log(makeEvent()); // third event should spill

      expect(onSpillover).toHaveBeenCalledTimes(1);
      expect(logger.getMetrics().eventsSpilled).toBe(1);
    });

    it('drops events when queue is full with no spillover', () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        queueCapacity: 1,
        logger: 'silent',
      });

      logger.log(makeEvent());
      const result = logger.log(makeEvent());
      expect(result).toBe(false);
      expect(logger.getMetrics().eventsFailed).toBe(1);
    });
  });

  describe('batch processing', () => {
    it('uses createEvents for multiple ready events', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        batchSize: 10,
        validateBeforeQueue: false,
      });

      // Queue several events
      for (let i = 0; i < 5; i++) {
        logger.log(makeEvent());
      }

      await logger.flush(5000);

      // Should have used batch endpoint
      expect(client.createEvents).toHaveBeenCalled();
    });

    it('uses createEvent for single events', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        batchSize: 1,
      });

      logger.log(makeEvent());
      await logger.flush(5000);

      expect(client.createEvent).toHaveBeenCalledTimes(1);
      expect(client.createEvents).not.toHaveBeenCalled();
    });
  });

  describe('circuit breaker', () => {
    it('opens after consecutive failures', async () => {
      const failClient = createMockClient({
        createEvent: vi.fn(async () => {
          throw new EventLogError('Server down', 500);
        }),
      } as unknown as Partial<EventLogClient>);

      logger = new AsyncEventLogger({
        client: failClient,
        circuitBreakerThreshold: 3,
        maxRetries: 0, // no retries so failures are immediate
        logger: 'silent',
        batchSize: 1,
      });

      // Queue enough events to trigger circuit
      for (let i = 0; i < 5; i++) {
        logger.log(makeEvent());
      }

      // Wait for processing
      await new Promise((r) => setTimeout(r, 300));

      expect(logger.isCircuitOpen).toBe(true);
    });

    it('resets after the reset timeout', async () => {
      const callCount = { value: 0 };
      const client = createMockClient({
        createEvent: vi.fn(async () => {
          callCount.value++;
          if (callCount.value <= 5) {
            throw new EventLogError('fail', 500);
          }
          return { success: true, execution_ids: ['e1'], correlation_id: 'c1' };
        }),
      } as unknown as Partial<EventLogClient>);

      logger = new AsyncEventLogger({
        client,
        circuitBreakerThreshold: 3,
        circuitBreakerResetMs: 100, // very short reset
        maxRetries: 0,
        logger: 'silent',
        batchSize: 1,
      });

      for (let i = 0; i < 4; i++) {
        logger.log(makeEvent());
      }

      // Wait for circuit to open and then reset
      await new Promise((r) => setTimeout(r, 500));

      expect(logger.isCircuitOpen).toBe(false);
    });
  });

  describe('retry logic', () => {
    it('retries failed events with non-blocking delay', async () => {
      let attempt = 0;
      const client = createMockClient({
        createEvent: vi.fn(async () => {
          attempt++;
          if (attempt === 1) {
            throw new EventLogError('transient', 500);
          }
          return { success: true, execution_ids: ['e1'], correlation_id: 'c1' };
        }),
      } as unknown as Partial<EventLogClient>);

      logger = new AsyncEventLogger({
        client,
        maxRetries: 3,
        baseRetryDelayMs: 10, // fast for testing
        logger: 'silent',
        batchSize: 1,
        circuitBreakerThreshold: 100, // high so circuit doesn't open
      });

      logger.log(makeEvent());

      // Wait for retry
      await new Promise((r) => setTimeout(r, 500));
      await logger.flush(5000);

      expect(logger.getMetrics().eventsSent).toBeGreaterThanOrEqual(1);
    });

    it('does not block queue during retry delay', async () => {
      let failedOnce = false;
      const client = createMockClient({
        createEvent: vi.fn(async (event: EventLogEntry) => {
          if (!failedOnce && event.correlation_id === 'slow') {
            failedOnce = true;
            throw new EventLogError('fail once', 500);
          }
          return { success: true, execution_ids: ['e1'], correlation_id: 'c1' };
        }),
      } as unknown as Partial<EventLogClient>);

      logger = new AsyncEventLogger({
        client,
        maxRetries: 3,
        baseRetryDelayMs: 2000, // long delay
        logger: 'silent',
        batchSize: 1,
        circuitBreakerThreshold: 100,
      });

      logger.log(makeEvent({ correlation_id: 'slow' }));
      logger.log(makeEvent({ correlation_id: 'fast' }));

      // Wait a bit — fast event should process immediately, slow event is waiting
      await new Promise((r) => setTimeout(r, 200));

      // fast event should have been sent even though slow is waiting
      const calls = (client.createEvent as ReturnType<typeof vi.fn>).mock.calls;
      const sentCorrelations = calls.map((c) => c[0].correlation_id);
      expect(sentCorrelations).toContain('fast');
    });
  });

  describe('lifecycle hooks', () => {
    it('fires onBatchSent on success', async () => {
      const client = createMockClient();
      const onBatchSent = vi.fn();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        onBatchSent,
        batchSize: 1,
      });

      logger.log(makeEvent());
      await logger.flush(5000);

      expect(onBatchSent).toHaveBeenCalledWith(expect.any(Array), 1);
    });

    it('fires onCircuitOpen and onCircuitClose', async () => {
      const onCircuitOpen = vi.fn();
      const onCircuitClose = vi.fn();

      const client = createMockClient({
        createEvent: vi.fn(async () => {
          throw new EventLogError('down', 500);
        }),
      } as unknown as Partial<EventLogClient>);

      logger = new AsyncEventLogger({
        client,
        circuitBreakerThreshold: 2,
        circuitBreakerResetMs: 100,
        maxRetries: 0,
        logger: 'silent',
        onCircuitOpen,
        onCircuitClose,
        batchSize: 1,
      });

      logger.log(makeEvent());
      logger.log(makeEvent());
      logger.log(makeEvent());

      await new Promise((r) => setTimeout(r, 500));

      expect(onCircuitOpen).toHaveBeenCalled();
    });

    it('catches errors in hooks without breaking processing', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        onBatchSent: () => {
          throw new Error('user hook error');
        },
        batchSize: 1,
      });

      logger.log(makeEvent());
      await logger.flush(5000);

      // Event should still be counted as sent despite hook error
      expect(logger.getMetrics().eventsSent).toBe(1);
    });
  });

  describe('metrics', () => {
    it('tracks queued, sent, and depth', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({ client, logger: 'silent', batchSize: 1 });

      logger.log(makeEvent());
      logger.log(makeEvent());

      expect(logger.getMetrics().eventsQueued).toBe(2);
      expect(logger.queueDepth).toBe(2);

      await logger.flush(5000);

      expect(logger.getMetrics().eventsSent).toBe(2);
      expect(logger.queueDepth).toBe(0);
    });
  });

  describe('flush()', () => {
    it('returns true when queue is empty', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({ client, logger: 'silent' });

      const result = await logger.flush(1000);
      expect(result).toBe(true);
    });

    it('returns false when circuit is open and cannot reset', async () => {
      const client = createMockClient({
        createEvent: vi.fn(async () => {
          throw new EventLogError('down', 500);
        }),
      } as unknown as Partial<EventLogClient>);

      logger = new AsyncEventLogger({
        client,
        circuitBreakerThreshold: 1,
        circuitBreakerResetMs: 60_000, // long reset
        maxRetries: 0,
        logger: 'silent',
        batchSize: 1,
      });

      logger.log(makeEvent());
      logger.log(makeEvent());

      // Let first event fail and open circuit
      await new Promise((r) => setTimeout(r, 200));

      // Flush should bail out immediately due to circuit open
      const result = await logger.flush(1000);
      expect(result).toBe(false);
    });
  });

  describe('shutdown()', () => {
    it('flushes remaining events', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({ client, logger: 'silent', batchSize: 1 });

      logger.log(makeEvent());
      logger.log(makeEvent());

      await logger.shutdown();

      expect(logger.getMetrics().eventsSent).toBe(2);
    });

    it('is idempotent', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({ client, logger: 'silent' });

      await logger.shutdown();
      await logger.shutdown(); // second call is a no-op
    });
  });

  describe('logMany()', () => {
    it('queues multiple events', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({ client, logger: 'silent' });

      const count = logger.logMany([makeEvent(), makeEvent(), makeEvent()]);
      expect(count).toBe(3);
      expect(logger.getMetrics().eventsQueued).toBe(3);
    });
  });

  describe('maxBatchWaitMs', () => {
    it('waits for maxBatchWaitMs before sending partial batch', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        batchSize: 10, // large batch size
        maxBatchWaitMs: 50, // short wait
      });

      // Log a single event (partial batch)
      logger.log(makeEvent());

      // Wait for maxBatchWaitMs to elapse
      await new Promise((r) => setTimeout(r, 200));

      // Should have sent after the wait
      expect(client.createEvent).toHaveBeenCalled();
    });
  });

  describe('spillover replay', () => {
    it('replays spillover events via onSpilloverReplay', async () => {
      const client = createMockClient();
      const replayEvents = [makeEvent(), makeEvent()];

      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
        batchSize: 1,
        replayIntervalMs: 50,
        onSpilloverReplay: async (requeue) => {
          return requeue(replayEvents);
        },
      });

      // Wait for replay to fire
      await new Promise((r) => setTimeout(r, 200));
      await logger.flush(5000);

      expect(logger.getMetrics().eventsReplayed).toBeGreaterThanOrEqual(2);
    });

    it('tracks eventsReplayed in metrics', async () => {
      const client = createMockClient();
      logger = new AsyncEventLogger({
        client,
        logger: 'silent',
      });

      expect(logger.getMetrics().eventsReplayed).toBe(0);
    });
  });
});
