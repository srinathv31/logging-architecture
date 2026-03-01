// ============================================================================
// MOCK ASYNC EVENT LOGGER - For testing
// ============================================================================

import { EventLogEntry } from '../models/types';
import { AsyncEventLoggerMetrics } from '../client/AsyncEventLogger';

/**
 * In-memory mock of AsyncEventLogger for unit testing.
 * Captures all logged events without making any network calls.
 *
 * @example
 * ```typescript
 * import { MockAsyncEventLogger } from '@yourcompany/eventlog-sdk/testing';
 *
 * const mock = new MockAsyncEventLogger();
 * // inject into your service under test
 * const service = new MyService({ eventLogger: mock });
 *
 * await service.doWork();
 *
 * expect(mock.capturedEvents).toHaveLength(2);
 * mock.assertEventLogged('MyProcess', 'PROCESS_START');
 * ```
 */
export class MockAsyncEventLogger {
  readonly capturedEvents: EventLogEntry[] = [];
  private _shouldAccept = true;

  /** Simulate queue full / shutdown — subsequent log() calls return false */
  rejectAll(): void {
    this._shouldAccept = false;
  }

  /** Re-enable accepting events */
  acceptAll(): void {
    this._shouldAccept = true;
  }

  log(event: EventLogEntry): boolean {
    if (!this._shouldAccept) return false;
    this.capturedEvents.push(event);
    return true;
  }

  logMany(events: EventLogEntry[]): number {
    let queued = 0;
    for (const event of events) {
      if (this.log(event)) queued++;
    }
    return queued;
  }

  get queueDepth(): number {
    return 0;
  }

  get isCircuitOpen(): boolean {
    return false;
  }

  getMetrics(): AsyncEventLoggerMetrics {
    return {
      eventsQueued: this.capturedEvents.length,
      eventsSent: this.capturedEvents.length,
      eventsFailed: 0,
      eventsSpilled: 0,
      eventsReplayed: 0,
      currentQueueDepth: 0,
      circuitOpen: false,
    };
  }

  async flush(): Promise<boolean> {
    return true;
  }

  async shutdown(): Promise<void> {
    // noop
  }

  // ========================================================================
  // Test Helpers
  // ========================================================================

  /** Get all events for a given process name */
  getEventsForProcess(processName: string): EventLogEntry[] {
    return this.capturedEvents.filter((e) => e.process_name === processName);
  }

  /**
   * Assert that an event matching the given criteria was logged.
   * Throws if no matching event is found.
   */
  assertEventLogged(
    processName: string,
    eventType?: string,
    eventStatus?: string
  ): EventLogEntry {
    const match = this.capturedEvents.find((e) => {
      if (e.process_name !== processName) return false;
      if (eventType && e.event_type !== eventType) return false;
      if (eventStatus && e.event_status !== eventStatus) return false;
      return true;
    });

    if (!match) {
      const criteria = [processName, eventType, eventStatus].filter(Boolean).join(', ');
      throw new Error(
        `No event found matching (${criteria}). ` +
          `Captured ${this.capturedEvents.length} events: ` +
          this.capturedEvents.map((e) => `${e.process_name}/${e.event_type}`).join(', ')
      );
    }

    return match;
  }

  /**
   * Assert that exactly `expected` events have been logged.
   * Throws if the count does not match.
   */
  assertEventCount(expected: number): void {
    if (this.capturedEvents.length !== expected) {
      throw new Error(
        `Expected ${expected} events, but got ${this.capturedEvents.length}. ` +
          `Events: ${this.capturedEvents.map((e) => `${e.process_name}/${e.event_type}`).join(', ')}`
      );
    }
  }

  /** Clear all captured events */
  reset(): void {
    this.capturedEvents.length = 0;
    this._shouldAccept = true;
  }
}
