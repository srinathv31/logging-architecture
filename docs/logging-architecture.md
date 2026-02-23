# Logging Architecture

Structured logging standard for the event-log-api monorepo using [Pino](https://github.com/pinojs/pino).

## Library Choice: Pino over Winston

| Factor | Pino | Winston |
|--------|------|---------|
| Already in monorepo | Yes (Fastify bundles it) | No |
| Performance | ~5x faster (low-overhead JSON serialization) | Slower |
| Structured JSON | Default behavior | Requires format config |
| Ecosystem alignment | Fastify's native logger | Standalone |

Pino keeps the monorepo on a single logging framework — the API already uses Pino through Fastify's built-in logger.

## Configuration

### Multistream Output

Every logger instance writes to two streams simultaneously:

1. **Console** — pretty-printed with colors in development (`pino-pretty`), structured JSON in production (`process.stdout`)
2. **Rotating file** — JSON lines written to `applogs/app.log` via `pino-roll`

### File Rotation Policy

| Setting | Value |
|---------|-------|
| Frequency | Daily |
| Retention | 14 files (2 weeks) |
| Directory | `applogs/` (auto-created via `mkdir: true`) |
| Format | JSON lines |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `"info"` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `NODE_ENV` | — | When not `"production"`, enables pretty-printed console output |

## File Structure (Dashboard)

```
dashboard/
├── logger.ts              # Core Pino logger (multistream + rotation)
├── server.ts              # Imports from ./logger.js
├── tsconfig.server.json   # Compiles both server.ts and logger.ts
└── src/
    └── lib/
        └── logger.ts      # Re-export: all src/ code imports from @/lib/logger
```

- **`dashboard/logger.ts`** — Core module. Initializes Pino with multistream (console + rotating file). Exports `getLogger()` (async, one-time init) and `createLogger(name)` (sync child logger factory).
- **`dashboard/src/lib/logger.ts`** — Thin re-export so Next.js `src/` code uses the `@/lib/logger` path alias. ESLint enforces this as the sole import path for `src/` files.

## Usage Patterns

### Initialization (server.ts)

The logger must be initialized once before any `createLogger()` calls:

```typescript
import { getLogger, createLogger } from "./logger.js";

// During startup
await getLogger();
const log = createLogger("server");
log.info({ hostname, port }, "Next.js server ready");
```

### Module-level logging (src/ files)

```typescript
import { createLogger } from "@/lib/logger";

const log = createLogger("mssql");

// Structured metadata as first argument, message as second
log.info({ server, database }, "Building MSSQL connection config");
log.warn({ attempt, delay, error: err.message }, "Token fetch failed, retrying");
log.error({ attempts: 3, error: err.message }, "Token fetch exhausted all retries");
log.debug("Returning cached database instance");
```

### Log Levels

| Level | Use for |
|-------|---------|
| `fatal` | Process is about to crash |
| `error` | Operation failed, requires attention |
| `warn` | Recoverable issue (retries, fallbacks) |
| `info` | Significant lifecycle events (startup, connections, refreshes) |
| `debug` | Detailed operational info (cache hits, routine checks) |
| `trace` | Very verbose debugging |

### Structured Metadata

Always pass context as the first argument (object), message as the second (string):

```typescript
// Good — structured and searchable
log.info({ userId: 123, action: "login" }, "User authenticated");

// Avoid — unstructured string interpolation
log.info(`User 123 authenticated via login`);
```

## ESLint Enforcement

The `no-restricted-imports` rule in `dashboard/eslint.config.mjs` ensures:

- `src/` files **must** import from `@/lib/logger` (the re-export)
- Direct imports of `pino`, `pino-roll`, or `pino-pretty` in `src/` are blocked
- Relative imports to root `logger.ts` (e.g., `../../logger`) in `src/` are blocked
- Root files (`server.ts`, `logger.ts`) are exempt — they need direct pino access

## Adopting in Other Projects

### API (Fastify)

The API already uses Pino through Fastify's built-in logger (`fastify.log`). No changes needed — Fastify configures Pino internally.

To add file rotation to the API, add `pino-roll` as a transport in the Fastify logger config.

### New Projects

1. Install `pino`, `pino-roll`, and `pino-pretty` (dev)
2. Copy the `logger.ts` pattern (multistream + rotation)
3. Call `await getLogger()` during startup
4. Use `createLogger("module-name")` in each module
