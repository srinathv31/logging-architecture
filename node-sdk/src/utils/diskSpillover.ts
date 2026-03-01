// ============================================================================
// DISK-BASED SPILLOVER WITH REPLAY
// ============================================================================

import { writeFile, mkdir, readFile, readdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { EventLogEntry } from '../models/types';

export interface DiskSpilloverConfig {
  /** Directory to write spillover files to */
  spilloverPath: string;

  /** Maximum number of events to keep in spillover (default: 10000) */
  maxSpilloverEvents?: number;

  /** Maximum total spillover size in MB (default: 50) */
  maxSpilloverSizeMb?: number;
}

export interface DiskSpilloverResult {
  /** Callback for AsyncEventLoggerConfig.onSpillover */
  onSpillover: (event: EventLogEntry) => void;

  /** Callback for AsyncEventLoggerConfig.onSpilloverReplay */
  onSpilloverReplay: (requeue: (events: EventLogEntry[]) => number) => Promise<number>;
}

/**
 * Creates a disk-based spillover callback for AsyncEventLogger.
 *
 * Writes events as NDJSON (newline-delimited JSON) to timestamped files
 * in the specified directory. Supports automatic replay of spillover files.
 *
 * @param configOrPath - Configuration object or path string (for backward compatibility)
 * @returns An object with onSpillover and onSpilloverReplay callbacks
 *
 * @example
 * ```typescript
 * const spillover = createDiskSpillover({
 *   spilloverPath: '/var/log/eventlog-spillover',
 *   maxSpilloverEvents: 10000,
 *   maxSpilloverSizeMb: 50,
 * });
 *
 * const logger = new AsyncEventLogger({
 *   client,
 *   onSpillover: spillover.onSpillover,
 *   onSpilloverReplay: spillover.onSpilloverReplay,
 *   replayIntervalMs: 10000,
 * });
 * ```
 */
export function createDiskSpillover(
  configOrPath: string | DiskSpilloverConfig
): DiskSpilloverResult & ((event: EventLogEntry) => void) {
  const config: DiskSpilloverConfig =
    typeof configOrPath === 'string'
      ? { spilloverPath: configOrPath }
      : configOrPath;

  const spilloverPath = config.spilloverPath;
  const maxEvents = config.maxSpilloverEvents ?? 10_000;
  const maxSizeMb = config.maxSpilloverSizeMb ?? 50;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  let buffer: string[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let dirEnsured = false;
  let totalEventsWritten = 0;
  let totalBytesWritten = 0;

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
      const content = lines.join('\n') + '\n';
      await writeFile(filename, content, 'utf-8');
      totalEventsWritten += lines.length;
      totalBytesWritten += Buffer.byteLength(content, 'utf-8');
    } catch {
      // Best-effort — if disk write fails, events are lost
    }
  };

  const onSpillover = (event: EventLogEntry) => {
    // Enforce limits
    if (totalEventsWritten >= maxEvents || totalBytesWritten >= maxSizeBytes) {
      return; // Drop silently — limits exceeded
    }

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

  const onSpilloverReplay = async (
    requeue: (events: EventLogEntry[]) => number
  ): Promise<number> => {
    try {
      await ensureDir();
      const files = await readdir(spilloverPath);
      const ndjsonFiles = files
        .filter((f) => f.endsWith('.ndjson'))
        .sort(); // oldest first

      let totalReplayed = 0;

      for (const file of ndjsonFiles) {
        const filePath = join(spilloverPath, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n').filter(Boolean);
          const events: EventLogEntry[] = [];

          for (const line of lines) {
            try {
              events.push(JSON.parse(line));
            } catch {
              // Skip malformed lines
            }
          }

          if (events.length > 0) {
            const replayed = requeue(events);
            totalReplayed += replayed;
          }

          // Rename to .replayed after successful processing
          const replayedPath = filePath.replace('.ndjson', '.replayed');
          await rename(filePath, replayedPath);

          // Update counters — replayed events no longer count against limits
          totalEventsWritten = Math.max(0, totalEventsWritten - lines.length);
          const fileStat = await stat(replayedPath).catch(() => null);
          if (fileStat) {
            totalBytesWritten = Math.max(0, totalBytesWritten - fileStat.size);
          }
        } catch {
          // Skip files that can't be read — they'll be retried next cycle
        }
      }

      return totalReplayed;
    } catch {
      return 0;
    }
  };

  // Create a function that also has the onSpillover and onSpilloverReplay properties
  // This maintains backward compatibility (callers who use createDiskSpillover as a function)
  const result = onSpillover as DiskSpilloverResult & ((event: EventLogEntry) => void);
  result.onSpillover = onSpillover;
  result.onSpilloverReplay = onSpilloverReplay;

  return result;
}
