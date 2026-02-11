// ============================================================================
// CONFIGURABLE LOGGER INTERFACE
// ============================================================================

/**
 * Logger interface for SDK internal logging.
 * Implement this to redirect SDK logs to your preferred logging framework.
 */
export interface EventLogLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Default logger that writes to console
 */
export class ConsoleLogger implements EventLogLogger {
  debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  }
  info(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }
  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }
  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}

/**
 * Silent logger that discards all output
 */
export class SilentLogger implements EventLogLogger {
  debug(): void { /* noop */ }
  info(): void { /* noop */ }
  warn(): void { /* noop */ }
  error(): void { /* noop */ }
}

/**
 * Resolve a logger config value to a concrete EventLogLogger instance
 */
export function resolveLogger(
  logger?: EventLogLogger | 'silent'
): EventLogLogger {
  if (logger === 'silent') return new SilentLogger();
  return logger ?? new ConsoleLogger();
}
