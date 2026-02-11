// ============================================================================
// EVENT LOG TEMPLATE - Reusable defaults for event construction
// ============================================================================

import { AsyncEventLogger } from './AsyncEventLogger';
import { ProcessLogger } from './ProcessLogger';

export interface EventLogTemplateConfig {
  /** The AsyncEventLogger to use for sending events */
  logger: AsyncEventLogger;

  /** Default application_id for all events */
  applicationId: string;

  /** Default target_system for all events */
  targetSystem: string;

  /** Default originating_system for all events */
  originatingSystem: string;

  /** Default account_id (optional — often set per-process) */
  accountId?: string;
}

/**
 * EventLogTemplate stores shared defaults and spawns ProcessLogger instances.
 *
 * This eliminates the biggest DX pain point: constructing full EventLogEntry
 * objects with 10+ repeated fields for every event.
 *
 * @example
 * ```typescript
 * const template = new EventLogTemplate({
 *   logger: asyncEventLogger,
 *   applicationId: 'account-origination',
 *   targetSystem: 'core-banking',
 *   originatingSystem: 'origination-service',
 * });
 *
 * const process = template.forProcess('CreateAccount', {
 *   accountId: '123456',
 *   identifiers: { customer_id: 'cust-789' },
 * });
 *
 * process.logStart('Initiating account creation');
 * process.logStep(1, 'VerifyIdentity', EventStatus.SUCCESS, 'Identity verified');
 * process.logEnd(EventStatus.SUCCESS, 'Account created', 3500);
 * ```
 */
export class EventLogTemplate {
  private readonly config: EventLogTemplateConfig;

  constructor(config: EventLogTemplateConfig) {
    this.config = config;
  }

  /**
   * Create a ProcessLogger scoped to a specific process.
   *
   * @param processName - The name of the business process
   * @param options - Per-process overrides
   */
  forProcess(
    processName: string,
    options?: {
      accountId?: string | null;
      correlationId?: string;
      traceId?: string;
      batchId?: string;
      identifiers?: Record<string, string>;
    }
  ): ProcessLogger {
    return new ProcessLogger({
      logger: this.config.logger,
      applicationId: this.config.applicationId,
      targetSystem: this.config.targetSystem,
      originatingSystem: this.config.originatingSystem,
      processName,
      accountId: options?.accountId ?? this.config.accountId,
      correlationId: options?.correlationId,
      traceId: options?.traceId,
      batchId: options?.batchId,
      identifiers: options?.identifiers,
    });
  }
}
