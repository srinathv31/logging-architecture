// ============================================================================
// ASYNC EVENT LOGGER - Fire-and-forget with resilience
// ============================================================================

import { EventLogClient, EventLogError } from './EventLogClient';
import { EventLogEntry } from '../models/types';

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
}

interface QueuedEvent {
  event: EventLogEntry;
  attempts: number;
  firstAttempt: Date;
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
  private isProcessing = false;
  private isShuttingDown = false;
  private processingTimer: ReturnType<typeof setInterval> | null = null;

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

    // Start processing loop
    this.startProcessing();

    // Register shutdown handlers
    if (typeof process !== 'undefined') {
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
      process.on('beforeExit', () => this.shutdown());
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
      console.warn('[EventLog] Cannot log event - shutdown in progress');
      return false;
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
        console.warn(
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
   * Flush all pending events (blocks until complete or timeout)
   */
  async flush(timeoutMs: number = 10_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (this.queue.length > 0 && Date.now() < deadline) {
      await this.sleep(50);
    }

    return this.queue.length === 0;
  }

  /**
   * Shutdown gracefully, flushing pending events
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log(`[EventLog] Shutting down - ${this.queue.length} events in queue`);

    // Stop the processing timer
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
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

    console.log(
      `[EventLog] Shutdown complete - sent: ${this._eventsSent}, failed: ${this._eventsFailed}, spilled: ${this._eventsSpilled}`
    );
  }

  // ==========================================================================
  // Internal - Processing Loop
  // ==========================================================================

  private startProcessing(): void {
    // Process queue every 10ms
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, 10);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    try {
      // Check circuit breaker
      if (this.circuitOpen) {
        if (this.shouldResetCircuit()) {
          this.resetCircuit();
        } else {
          return; // Don't process while circuit is open
        }
      }

      // Take next event from queue
      const queued = this.queue.shift();
      if (!queued) return;

      try {
        await this.client.createEvent(queued.event);
        this.onSuccess();
        this._eventsSent++;
      } catch (error) {
        await this.onFailure(queued, error as Error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private async onFailure(queued: QueuedEvent, error: Error): Promise<void> {
    this.consecutiveFailures++;

    const statusCode = error instanceof EventLogError ? error.statusCode : undefined;
    console.warn(
      `[EventLog] Failed to send event (attempt ${queued.attempts + 1}): ` +
        `correlationId=${queued.event.correlation_id}, status=${statusCode}, error=${error.message}`
    );

    // Check if we should open circuit
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      this.openCircuit();
    }

    // Retry or give up
    if (queued.attempts < this.maxRetries) {
      await this.scheduleRetry(queued);
    } else {
      console.error(
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

  private async scheduleRetry(queued: QueuedEvent): Promise<void> {
    const delay = this.calculateRetryDelay(queued.attempts);

    await this.sleep(delay);

    // Re-add to queue with incremented attempts
    this.queue.push({
      ...queued,
      attempts: queued.attempts + 1,
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
      console.warn(
        `[EventLog] Circuit breaker OPENED - API unavailable after ${this.circuitBreakerThreshold} failures`
      );
    }
  }

  private shouldResetCircuit(): boolean {
    return Date.now() - this.circuitOpenedAt >= this.circuitBreakerResetMs;
  }

  private resetCircuit(): void {
    this.circuitOpen = false;
    this.consecutiveFailures = 0;
    console.log('[EventLog] Circuit breaker RESET - resuming normal operation');
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
