// ============================================================================
// ASYNC LOCAL STORAGE CONTEXT PROPAGATION
// ============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Context data that can be propagated through AsyncLocalStorage.
 * When set, ProcessLogger and EventLogTemplate will auto-read these values
 * if not explicitly provided in their configs.
 */
export interface EventLogContextData {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  batchId?: string;
  accountId?: string;
}

/**
 * EventLogContext provides AsyncLocalStorage-based context propagation
 * for event log data. This is the Node.js equivalent of Java's SLF4J MDC.
 *
 * @example
 * ```typescript
 * import { eventLogContext } from '@yourcompany/eventlog-sdk';
 *
 * // In middleware (Express, Fastify, etc.)
 * app.use((req, res, next) => {
 *   eventLogContext.run(
 *     { correlationId: req.headers['x-correlation-id'], traceId: req.headers['x-trace-id'] },
 *     () => next()
 *   );
 * });
 *
 * // In your service — ProcessLogger auto-reads from context
 * const process = template.forProcess('HandleRequest');
 * // correlationId and traceId are auto-populated from context!
 * ```
 */
export class EventLogContext {
  private readonly storage = new AsyncLocalStorage<EventLogContextData>();

  /**
   * Run a function with the given context data.
   * All code executed within `fn` (including async continuations) will
   * have access to this context via `get()`.
   */
  run<T>(data: EventLogContextData, fn: () => T): T {
    return this.storage.run({ ...data }, fn);
  }

  /**
   * Get the current context data, or undefined if not inside a `run()` call.
   */
  get(): EventLogContextData | undefined {
    return this.storage.getStore();
  }

  /**
   * Update a single key in the current context.
   * No-op if called outside a `run()` scope.
   */
  set<K extends keyof EventLogContextData>(key: K, value: EventLogContextData[K]): void {
    const store = this.storage.getStore();
    if (store) {
      store[key] = value;
    }
  }
}

/** Singleton instance — import this for context propagation */
export const eventLogContext = new EventLogContext();
