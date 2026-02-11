// ============================================================================
// ASYNC EVENT LOGGER - Fire-and-forget with resilience
// ============================================================================

import { EventLogClient, EventLogError } from './EventLogClient';
import { EventLogEntry } from '../models/types';
import { truncatePayload, validateEvent } from '../utils/helpers';
import { EventLogLogger, resolveLogger } from '../utils/logger';

export interface AsyncEventLoggerConfig {
  /** The EventLogClient to use for sending events */
  client: EventLogClient;
  
  /** Maximum events to buffer (default: 10000) */
  queueCapacity?: number;
  
  /** Max retry attempts per event (default: 3) */
  maxRetries?: number;
  
  /** Base retry delay in ms (default: 1000) */
  baseRetryDelayMs?: number;
  
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelayMs?: number;
  
  /** Consecutive failures before circuit opens (default: 5) */
  circuitBreakerThreshold?: number;
  
  /** Time before circuit resets in ms (default: 30000) */
  circuitBreakerResetMs?: number;
  
  /** Callback when event fails permanently */
  onEventFailed?: (event: EventLogEntry, error: Error) => void;
  
  /** Callback for spillover (implement your own disk/queue storage) */
  onSpillover?: (event: EventLogEntry) => void;

  /** Default application_id injected into events that don't specify one */
  applicationId?: string;

  /** Number of events to drain per processing tick (default: 25). Set to 1 to disable batching. */
  batchSize?: number;

  /** Max payload size in bytes before truncation (default: 32768 = 32KB) */
  maxPayloadSize?: number;

  /** Logger for SDK internal messages. Pass 'silent' to suppress all output. */
  logger?: EventLogLogger | 'silent';

  /** Validate events before queuing (default: true). Invalid events are dropped with onEventFailed. */
  validateBeforeQueue?: boolean;

  // --- Lifecycle hooks ---

  /** Called after a batch of events is successfully sent */
  onBatchSent?: (events: EventLogEntry[], count: number) => void;

  /** Called when a batch send fails */
  onBatchFailed?: (events: EventLogEntry[], error: Error) => void;

  /** Called when the circuit breaker opens */
  onCircuitOpen?: (consecutiveFailures: number) => void;

  /** Called when the circuit breaker resets */
  onCircuitClose?: () => void;
}

interface QueuedEvent {
  event: EventLogEntry;
  attempts: number;
  firstAttempt: Date;
  retryAfter?: number; // timestamp — skip until Date.now() >= this
}

export interface AsyncEventLoggerMetrics {
  eventsQueued: number;
  eventsSent: number;
  eventsFailed: number;
  eventsSpilled: number;
  currentQueueDepth: number;
  circuitOpen: boolean;
}

/**
 * Async Event Logger - Fire-and-forget event logging with resilience
 * 
 * @example
 * ```typescript
 * // Create once at application startup
 * const eventLog = new AsyncEventLogger({
 *   client: eventLogClient,
 *   onSpillover: (event) => {
 *     // Save to local file or dead letter queue
 *     fs.appendFileSync('spillover.json', JSON.stringify(event) + '\n');
 *   },
 * });
 * 
 * // In your business logic - fire and forget
 * eventLog.log(event);  // Returns immediately
 * 
 * // At shutdown
 * await eventLog.shutdown();
 * ```
 */
export class AsyncEventLogger {
  private readonly client: EventLogClient;
  private readonly queue: QueuedEvent[] = [];
  private readonly maxQueueSize: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerResetMs: number;
  private readonly onEventFailed?: (event: EventLogEntry, error: Error) => void;
  private readonly onSpillover?: (event: EventLogEntry) => void;
  private readonly applicationId?: string;
  private readonly batchSize: number;
  private readonly maxPayloadSize: number;
  private readonly logger: EventLogLogger;
  private readonly validateBeforeQueue: boolean;
  private readonly onBatchSent?: (events: EventLogEntry[], count: number) => void;
  private readonly onBatchFailed?: (events: EventLogEntry[], error: Error) => void;
  private readonly onCircuitOpen?: (consecutiveFailures: number) => void;
  private readonly onCircuitClose?: () => void;

  // Circuit breaker state
  private circuitOpen = false;
  private consecutiveFailures = 0;
  private circuitOpenedAt = 0;

  // Metrics
  private _eventsQueued = 0;
  private _eventsSent = 0;
  private _eventsFailed = 0;
  private _eventsSpilled = 0;

  // Processing state
  private isShuttingDown = false;
  private processingTimer: ReturnType<typeof setTimeout> | null = null;

  // Signal handler references for cleanup
  private readonly _onSigterm: (() => void) | null = null;
  private readonly _onSigint: (() => void) | null = null;

  constructor(config: AsyncEventLoggerConfig) {
    this.client = config.client;
    this.maxQueueSize = config.queueCapacity ?? 10_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.baseRetryDelayMs = config.baseRetryDelayMs ?? 1000;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? 30_000;
    this.circuitBreakerThreshold = config.circuitBreakerThreshold ?? 5;
    this.circuitBreakerResetMs = config.circuitBreakerResetMs ?? 30_000;
    this.onEventFailed = config.onEventFailed;
    this.onSpillover = config.onSpillover;
    this.applicationId = config.applicationId;
    this.batchSize = config.batchSize ?? 25;
    this.maxPayloadSize = config.maxPayloadSize ?? 32_768;
    this.logger = resolveLogger(config.logger);
    this.validateBeforeQueue = config.validateBeforeQueue ?? true;
    this.onBatchSent = config.onBatchSent;
    this.onBatchFailed = config.onBatchFailed;
    this.onCircuitOpen = config.onCircuitOpen;
    this.onCircuitClose = config.onCircuitClose;

    // Start processing loop
    this.startProcessing();

    // Register shutdown handlers (once to prevent accumulation)
    if (typeof process !== 'undefined') {
      this._onSigterm = () => { this.shutdown().then(() => process.exit(0)); };
      this._onSigint = () => { this.shutdown().then(() => process.exit(0)); };
      process.once('SIGTERM', this._onSigterm);
      process.once('SIGINT', this._onSigint);
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Log an event asynchronously (fire-and-forget)
   * 
   * This method returns immediately. The event is queued and sent
   * in the background.
   * 
   * @returns true if queued, false if dropped
   */
  log(event: EventLogEntry): boolean {
    if (this.isShuttingDown) {
      this.logger.warn('[EventLog] Cannot log event - shutdown in progress');
      return false;
    }

    // Auto-populate application_id from config if not set on the event
    if (this.applicationId && !event.application_id) {
      event = { ...event, application_id: this.applicationId };
    }

    // Validate before queuing
    if (this.validateBeforeQueue) {
      const errors = validateEvent(event);
      if (errors.length > 0) {
        const validationError = new Error(`Validation failed: ${errors.join(', ')}`);
        this.logger.warn(
          `[EventLog] Event validation failed: ${errors.join(', ')} - correlationId=${event.correlation_id}`
        );
        if (this.onEventFailed) {
          try { this.onEventFailed(event, validationError); } catch { /* don't break caller */ }
        }
        this._eventsFailed++;
        return false;
      }
    }

    // Truncate oversized payloads
    const truncReq = truncatePayload(event.request_payload, this.maxPayloadSize);
    const truncResp = truncatePayload(event.response_payload, this.maxPayloadSize);
    if (truncReq !== event.request_payload || truncResp !== event.response_payload) {
      event = {
        ...event,
        request_payload: truncReq,
        response_payload: truncResp,
      };
    }

    const queued: QueuedEvent = {
      event,
      attempts: 0,
      firstAttempt: new Date(),
    };

    if (this.queue.length >= this.maxQueueSize) {
      // Queue full - spillover or drop
      if (this.onSpillover) {
        this.onSpillover(event);
        this._eventsSpilled++;
        return true;
      } else {
        this.logger.warn(
          `[EventLog] Queue full, dropping event: correlationId=${event.correlation_id}`
        );
        this._eventsFailed++;
        return false;
      }
    }

    this.queue.push(queued);
    this._eventsQueued++;
    return true;
  }

  /**
   * Log multiple events
   * @returns Number of events successfully queued
   */
  logMany(events: EventLogEntry[]): number {
    let queued = 0;
    for (const event of events) {
      if (this.log(event)) queued++;
    }
    return queued;
  }

  /**
   * Get current queue depth
   */
  get queueDepth(): number {
    return this.queue.length;
  }

  /**
   * Check if circuit breaker is open
   */
  get isCircuitOpen(): boolean {
    return this.circuitOpen;
  }

  /**
   * Get metrics snapshot
   */
  getMetrics(): AsyncEventLoggerMetrics {
    return {
      eventsQueued: this._eventsQueued,
      eventsSent: this._eventsSent,
      eventsFailed: this._eventsFailed,
      eventsSpilled: this._eventsSpilled,
      currentQueueDepth: this.queue.length,
      circuitOpen: this.circuitOpen,
    };
  }

  /**
   * Flush all pending events (actively processes queue until empty or timeout)
   */
  async flush(timeoutMs: number = 10_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (this.queue.length > 0 && Date.now() < deadline) {
      // If circuit is open and won't reset, stop spinning
      if (this.circuitOpen && !this.shouldResetCircuit()) {
        return false;
      }
      await this.processQueue();
      // Small yield to avoid starving the event loop
      await this.sleep(1);
    }

    return this.queue.length === 0;
  }

  /**
   * Shutdown gracefully, flushing pending events
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info(`[EventLog] Shutting down - ${this.queue.length} events in queue`);

    // Remove signal handlers
    if (typeof process !== 'undefined') {
      if (this._onSigterm) process.removeListener('SIGTERM', this._onSigterm);
      if (this._onSigint) process.removeListener('SIGINT', this._onSigint);
    }

    // Stop the processing timer
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }

    // Flush remaining events with timeout
    const flushed = await this.flush(10_000);
    
    if (!flushed && this.onSpillover) {
      // Spill remaining events
      while (this.queue.length > 0) {
        const queued = this.queue.shift()!;
        this.onSpillover(queued.event);
        this._eventsSpilled++;
      }
    }

    this.logger.info(
      `[EventLog] Shutdown complete - sent: ${this._eventsSent}, failed: ${this._eventsFailed}, spilled: ${this._eventsSpilled}`
    );
  }

  // ==========================================================================
  // Internal - Processing Loop
  // ==========================================================================

  private startProcessing(): void {
    const scheduleNext = () => {
      if (this.isShuttingDown) return;
      // Immediate when queue has items, 50ms idle poll
      const delay = this.queue.length > 0 ? 0 : 50;
      this.processingTimer = setTimeout(async () => {
        await this.processQueue();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    // Check circuit breaker
    if (this.circuitOpen) {
      if (this.shouldResetCircuit()) {
        this.resetCircuit();
      } else {
        return; // Don't process while circuit is open
      }
    }

    // Collect up to batchSize ready events
    const now = Date.now();
    const ready: QueuedEvent[] = [];
    const readyIndices: number[] = [];

    for (let i = 0; i < this.queue.length && ready.length < this.batchSize; i++) {
      const q = this.queue[i];
      if (!q.retryAfter || q.retryAfter <= now) {
        ready.push(q);
        readyIndices.push(i);
      }
    }

    if (ready.length === 0) return;

    // Remove from queue in reverse order to preserve indices
    for (let i = readyIndices.length - 1; i >= 0; i--) {
      this.queue.splice(readyIndices[i], 1);
    }

    const events = ready.map((q) => q.event);

    // Single event — use singular endpoint for efficiency
    if (ready.length === 1) {
      const queued = ready[0];
      try {
        await this.client.createEvent(queued.event);
        this.onSuccess();
        this._eventsSent++;
        this.fireHook(this.onBatchSent, events, 1);
      } catch (error) {
        this.handleFailure(queued, error as Error);
        this.fireHook(this.onBatchFailed, events, error as Error);
      }
      return;
    }

    // Batch send
    try {
      await this.client.createEvents(events);
      this.onSuccess();
      this._eventsSent += ready.length;
      this.fireHook(this.onBatchSent, events, ready.length);
    } catch (error) {
      // Batch failed — re-enqueue all for individual retry
      for (const queued of ready) {
        this.handleFailure(queued, error as Error);
      }
      this.fireHook(this.onBatchFailed, events, error as Error);
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private handleFailure(queued: QueuedEvent, error: Error): void {
    this.consecutiveFailures++;

    const statusCode = error instanceof EventLogError ? error.statusCode : undefined;
    this.logger.warn(
      `[EventLog] Failed to send event (attempt ${queued.attempts + 1}): ` +
        `correlationId=${queued.event.correlation_id}, status=${statusCode}, error=${error.message}`
    );

    // Check if we should open circuit
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      this.openCircuit();
    }

    // Retry or give up
    if (queued.attempts < this.maxRetries) {
      this.scheduleRetry(queued);
    } else {
      this.logger.error(
        `[EventLog] Event permanently failed after ${this.maxRetries} attempts: ` +
          `correlationId=${queued.event.correlation_id}`
      );

      if (this.onSpillover) {
        this.onSpillover(queued.event);
        this._eventsSpilled++;
      } else if (this.onEventFailed) {
        this.onEventFailed(queued.event, error);
      }
      this._eventsFailed++;
    }
  }

  private scheduleRetry(queued: QueuedEvent): void {
    const delay = this.calculateRetryDelay(queued.attempts);

    // Non-blocking: set retryAfter timestamp and re-push immediately
    this.queue.push({
      ...queued,
      attempts: queued.attempts + 1,
      retryAfter: Date.now() + delay,
    });
  }

  private calculateRetryDelay(attempts: number): number {
    // Exponential backoff with jitter
    let delay = this.baseRetryDelayMs * Math.pow(2, attempts);
    delay = Math.min(delay, this.maxRetryDelayMs);
    // Add jitter (±25%)
    delay = delay + delay * 0.25 * (Math.random() - 0.5);
    return delay;
  }

  // ==========================================================================
  // Internal - Circuit Breaker
  // ==========================================================================

  private openCircuit(): void {
    if (!this.circuitOpen) {
      this.circuitOpen = true;
      this.circuitOpenedAt = Date.now();
      this.logger.warn(
        `[EventLog] Circuit breaker OPENED - API unavailable after ${this.circuitBreakerThreshold} failures`
      );
      this.fireHook(this.onCircuitOpen, this.consecutiveFailures);
    }
  }

  private shouldResetCircuit(): boolean {
    return Date.now() - this.circuitOpenedAt >= this.circuitBreakerResetMs;
  }

  private resetCircuit(): void {
    this.circuitOpen = false;
    this.consecutiveFailures = 0;
    this.logger.info('[EventLog] Circuit breaker RESET - resuming normal operation');
    this.fireHook(this.onCircuitClose);
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  /** Safely invoke a user-provided hook — never let it break the SDK */
  private fireHook<A extends unknown[]>(hook: ((...args: A) => void) | undefined, ...args: A): void {
    if (!hook) return;
    try { hook(...args); } catch (err) {
      this.logger.warn(`[EventLog] Lifecycle hook threw: ${err}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
