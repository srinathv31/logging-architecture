import pino from "pino";
import pinoRoll from "pino-roll";

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL || "info";

// Build multistream targets
async function buildLogger() {
  const streams: pino.StreamEntry[] = [];

  // Console: pretty in dev, structured JSON in prod
  if (isDev) {
    const pinoPretty = (await import("pino-pretty")).default;
    streams.push({ stream: pinoPretty({ colorize: true }) });
  } else {
    streams.push({ stream: process.stdout });
  }

  // Rotating file transport
  const fileStream = await pinoRoll({
    file: "applogs/app.log",
    frequency: "daily",
    limit: { count: 14 },
    mkdir: true,
  });
  streams.push({ stream: fileStream });

  return pino({ level }, pino.multistream(streams));
}

// Eager initialization — awaited once, cached forever
let _logger: pino.Logger | null = null;
let _initPromise: Promise<pino.Logger> | null = null;

export async function getLogger(): Promise<pino.Logger> {
  if (_logger) return _logger;
  if (!_initPromise) {
    _initPromise = buildLogger().then((l) => {
      _logger = l;
      return l;
    });
  }
  return _initPromise;
}

export function createLogger(name: string): pino.Logger {
  // Synchronous child logger — requires getLogger() to have been called first
  if (!_logger) {
    // Fallback: return a basic pino logger (should only happen during startup race)
    const fallback = pino({ level });
    return fallback.child({ module: name });
  }
  return _logger.child({ module: name });
}
