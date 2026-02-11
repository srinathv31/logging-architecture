// ============================================================================
// DISK-BASED SPILLOVER
// ============================================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { EventLogEntry } from '../models/types';

/**
 * Creates a disk-based spillover callback for AsyncEventLogger.
 *
 * Writes events as NDJSON (newline-delimited JSON) to timestamped files
 * in the specified directory. Uses non-blocking async writes.
 *
 * @param spilloverPath - Directory to write spillover files to
 * @returns A spillover callback function compatible with AsyncEventLoggerConfig.onSpillover
 *
 * @example
 * ```typescript
 * const logger = new AsyncEventLogger({
 *   client,
 *   onSpillover: createDiskSpillover('/var/log/eventlog-spillover'),
 * });
 * ```
 */
export function createDiskSpillover(
  spilloverPath: string
): (event: EventLogEntry) => void {
  let buffer: string[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let dirEnsured = false;

  const ensureDir = async () => {
    if (dirEnsured) return;
    if (!existsSync(spilloverPath)) {
      await mkdir(spilloverPath, { recursive: true });
    }
    dirEnsured = true;
  };

  const flushBuffer = async () => {
    if (buffer.length === 0) return;
    const lines = buffer;
    buffer = [];

    try {
      await ensureDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = join(spilloverPath, `spillover-${timestamp}.ndjson`);
      await writeFile(filename, lines.join('\n') + '\n', 'utf-8');
    } catch {
      // Best-effort — if disk write fails, events are lost
      // The SDK already counted them as spilled in metrics
    }
  };

  return (event: EventLogEntry) => {
    buffer.push(JSON.stringify(event));

    // Debounce: flush after 100ms of no new events, or immediately at 100 events
    if (buffer.length >= 100) {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      flushBuffer();
    } else if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushBuffer();
      }, 100);
    }
  };
}
