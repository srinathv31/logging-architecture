# Node SDK Enhancement Plan

Enhancements to better align the TypeScript/Node.js SDK with the core philosophies:
**Easy to Use, Easy to Configure, Non-Blocking**

Reference: Java SDK feature parity where applicable (not 1:1 — Java SDK is Spring Boot-integrated, Node SDK is framework-agnostic).

---

## P0 — Bugs / Critical Fixes

### 1. Fix: Retry sleep blocks entire queue
**File:** `AsyncEventLogger.ts` — `scheduleRetry()` (line 330)

`scheduleRetry` does `await this.sleep(delay)` inside `processQueue()`, which holds `isProcessing = true` for up to 30 seconds. During that time, the entire queue is frozen — no other events can be sent.

**Fix:** Remove the sleep from `scheduleRetry`. Instead, add a `retryAfter: number` (timestamp) field to `QueuedEvent`. Re-enqueue immediately with the future timestamp. In `processQueue`, skip events whose `retryAfter > Date.now()` and move them to the back of the queue.

**Philosophy:** Non-Blocking

---

### 2. Fix: Signal handlers accumulate and prevent process exit
**File:** `AsyncEventLogger.ts` — constructor (lines 117-120)

Each `AsyncEventLogger` instance adds new `SIGTERM`/`SIGINT`/`beforeExit` listeners that never get cleaned up. Worse, `process.on('SIGINT')` overrides Node's default behavior — after `shutdown()` completes, the process hangs because Node no longer terminates on SIGINT.

**Fix:**
- Use `process.once()` instead of `process.on()`
- After shutdown completes, call `process.exit(0)` in the signal handlers (not in `beforeExit`)
- Store listener references so they can be removed in `shutdown()` (prevent double-fire)

**Philosophy:** Easy to Use (don't surprise the developer with a hanging process)

---

### 3. Fix: `flush()` is a passive spin loop
**File:** `AsyncEventLogger.ts` — `flush()` (line 210)

`flush()` polls `this.queue.length` every 50ms but doesn't actively process events. If the processing loop is stalled (circuit open, retry sleeping per bug #1), flush spins until timeout doing nothing useful. The shutdown path calls `flush(10_000)` which can block for 10 seconds pointlessly.

**Fix:** `flush()` should actively drain the queue itself (or signal the processing loop to accelerate). At minimum, flush should detect circuit-open state and immediately fall through to spillover rather than waiting.

**Philosophy:** Non-Blocking

---

### 4. Fix: Client retry backoff is linear, not exponential
**File:** `EventLogClient.ts` — `request()` (line 216)

Comment says "Exponential backoff" but the actual formula is `500 * attempt` (linear: 500, 1000, 1500ms). The `AsyncEventLogger` does proper exponential (`base * 2^attempt`).

**Fix:** Use `Math.min(baseDelay * Math.pow(2, attempt), maxDelay)` to match the async logger's pattern.

**Philosophy:** Easy to Configure (consistent behavior across both code paths)

---

## P1 — Non-Blocking Improvements

### 5. Batch drain: Send multiple events per tick
**File:** `AsyncEventLogger.ts` — `processQueue()` (line 263)

Currently dequeues and sends one event per 10ms tick via `createEvent()`. Max throughput: ~100 events/second. A full 10k queue takes ~100 seconds to drain.

**Enhancement:** Dequeue up to N events (configurable `batchSize`, default 25) per tick and send them via `client.createEvents()` in a single HTTP call. This is what high-throughput logging systems do.

**New config option:**
```typescript
batchSize?: number;  // Max events per HTTP call (default: 25)
```

**Java SDK reference:** Java SDK also sends one-at-a-time from the async logger, but the Node SDK has the unique opportunity to improve on this since the batch endpoint already exists and `fetch` is inherently async.

**Philosophy:** Non-Blocking (faster drain = less queue pressure = fewer drops)

---

### 6. Processing loop: Replace `setInterval` with recursive `setTimeout`
**File:** `AsyncEventLogger.ts` — `startProcessing()` (line 256)

`setInterval(fn, 10)` fires every 10ms regardless of whether the previous tick finished. If `processQueue` takes longer than 10ms (network call + retry), multiple overlapping invocations can stack up. The `isProcessing` guard prevents re-entry, but the interval keeps firing pointlessly.

**Enhancement:** Use a self-scheduling `setTimeout` pattern:
```typescript
private scheduleNext(): void {
  this.processingTimer = setTimeout(async () => {
    await this.processQueue();
    if (!this.isShuttingDown) this.scheduleNext();
  }, this.queue.length > 0 ? 0 : 50);  // Immediate if work, 50ms idle poll
}
```

Benefits: No overlapping ticks, adaptive polling (fast when busy, slow when idle), cleaner shutdown.

**Philosophy:** Non-Blocking (efficient event loop usage)

---

## P2 — Easy to Use Improvements

### 7. Add `EventLogTemplate` — default context + simplified API
**Java SDK reference:** `EventLogTemplate.java` + `ProcessLogger`

The Java SDK's `EventLogTemplate` is a major DX win. It stores default values (`applicationId`, `targetSystem`, `originatingSystem`) so callers don't repeat them on every event. It also provides a `ProcessLogger` for scoped, fluent logging within a single process.

**Enhancement:** Add an `EventLogTemplate` class:
```typescript
const template = new EventLogTemplate(asyncLogger, {
  applicationId: 'onboarding-service',
  targetSystem: 'ONBOARDING_SERVICE',
  originatingSystem: 'WEB_APP',
});

// Scoped process logger
const process = template.forProcess('ADD_AUTH_USER', {
  correlationId: createCorrelationId('user'),
  traceId: createTraceId(),
  accountId: 'AC-9876',
});

process.logStart('Initiating user creation');
process.logStep(1, 'Validate Input', EventStatus.SUCCESS, 'Input valid', 'VALIDATED');
process.logStep(2, 'Create Record', EventStatus.SUCCESS, 'User created', 'CREATED');
process.logEnd(EventStatus.SUCCESS, 'User onboarded', 'COMPLETE', totalMs);
process.logError('VALIDATION_ERR', 'SSN mismatch', 'Validation failed');
```

This eliminates the biggest usability pain point: constructing full `EventLogEntry` objects with 10+ repeated fields for every single log call.

**Philosophy:** Easy to Use

---

### 8. Add `MockAsyncEventLogger` for testing
**Java SDK reference:** `MockAsyncEventLogger.java` + `EventLogTestAutoConfiguration`

The Java SDK provides an in-memory mock logger for testing. The Node SDK has zero test support.

**Enhancement:** Add `src/testing/MockAsyncEventLogger.ts`:
```typescript
import { MockAsyncEventLogger } from '@yourcompany/eventlog-sdk/testing';

const mockLogger = new MockAsyncEventLogger();

// Use in your code exactly like AsyncEventLogger
mockLogger.log(event);

// Assert in tests
expect(mockLogger.capturedEvents).toHaveLength(3);
expect(mockLogger.getEventsForProcess('ADD_AUTH_USER')).toHaveLength(3);
mockLogger.assertEventLogged('ADD_AUTH_USER', EventType.STEP);
mockLogger.reset();
```

Export from a separate entry point (`/testing`) so it's not bundled into production code. Update `package.json` exports:
```json
"exports": {
  ".": { ... },
  "./testing": {
    "import": "./dist/testing.mjs",
    "require": "./dist/testing.js",
    "types": "./dist/testing.d.ts"
  }
}
```

**Philosophy:** Easy to Use (testability is usability)

---

### 9. Auto-populate `application_id` from client config
**File:** `AsyncEventLogger.ts` / `EventLogClient.ts`

`applicationId` on `EventLogClientConfig` only sets an `X-Application-Id` header. It does NOT populate `application_id` on events — which is a required field that callers must set on every single event manually.

**Enhancement:** If `applicationId` is set on the client config, auto-inject it into events that don't already have one set. Do this in `AsyncEventLogger.log()` or the builder functions. This removes a common source of repetition and errors.

**Philosophy:** Easy to Use, Easy to Configure

---

### 10. Write actual tests
**Current state:** `package.json` has `"test": "vitest"` but no test files exist.

**Enhancement:** Add tests covering:
- `EventLogClient`: Request formation, retry on 5xx/429, no retry on 4xx, timeout, auth header injection
- `AsyncEventLogger`: Queue/dequeue, circuit breaker open/close/reset, retry scheduling, spillover callback, shutdown flush, metrics accuracy
- `TokenProvider`: OAuth token caching, concurrent refresh deduplication, token expiry + refresh buffer, invalidation
- `helpers`: ID format validation, builder field defaults, `validateEvent` completeness

The `fetch` injection pattern makes all HTTP-level tests straightforward — no mocking libraries needed.

**Philosophy:** Easy to Use (confidence that the SDK actually works)

---

## P3 — Easy to Configure Improvements

### 11. Disk-based spillover option
**Java SDK reference:** `AsyncEventLogger.builder().spilloverPath(Path.of(...))`

The Node SDK's `onSpillover` callback puts the burden on the caller to implement file writing. The Java SDK has built-in disk spillover with configurable path and NDJSON file format.

**Enhancement:** Add a built-in `spilloverPath` config option:
```typescript
const logger = new AsyncEventLogger({
  client,
  spilloverPath: '/var/log/eventlog-spillover',
  // Creates files: eventlog-spill-{ISO-timestamp}.ndjson
  // One JSON event per line
});
```

This should be optional — `onSpillover` callback remains for custom implementations. If `spilloverPath` is set, the SDK handles file I/O internally using `fs.appendFile` (non-blocking). If both are set, `spilloverPath` takes precedence.

**Philosophy:** Easy to Configure (zero-code spillover setup)

---

### 12. Configurable logger (replace `console.log`/`console.warn`)
**Current state:** SDK uses `console.log`, `console.warn`, `console.error` throughout. No way to suppress, redirect, or integrate with the app's logging framework (pino, winston, bunyan, etc.).

**Java SDK reference:** Uses SLF4J — integrates with whatever logging backend the app uses.

**Enhancement:** Add a `Logger` interface and config option:
```typescript
interface EventLogLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// Config
const logger = new AsyncEventLogger({
  client,
  logger: pinoInstance,  // or winston, or custom, or 'silent'
});
```

Provide a `ConsoleLogger` (default) and a `SilentLogger` (for suppressing output in tests). Accept `'silent'` as a shorthand.

**Philosophy:** Easy to Configure

---

### 13. Validate events before queuing
**File:** `AsyncEventLogger.ts` — `log()` (line 135)

Events are queued without any validation. If a required field is missing (`correlation_id`, `trace_id`, etc.), the error only surfaces when the API rejects it — after retry delays and queue processing.

**Enhancement:** Call `validateEvent()` in `log()` before queuing. If validation fails, log a warning and return `false` immediately. Make this configurable (`validateBeforeQueue: boolean`, default `true`). This gives developers fast feedback during development.

**Philosophy:** Easy to Use (fail fast, not fail later)

---

## P4 — Nice-to-Have / Future

### 14. Expose `onBatchSent` / `onBatchFailed` event hooks
Allow callers to hook into lifecycle events for monitoring/alerting without polling `getMetrics()`:
```typescript
const logger = new AsyncEventLogger({
  client,
  onBatchSent: (count) => metrics.increment('eventlog.sent', count),
  onBatchFailed: (count, error) => metrics.increment('eventlog.failed', count),
  onCircuitOpen: () => alerting.warn('Event log circuit open'),
  onCircuitClose: () => alerting.info('Event log circuit recovered'),
});
```

**Philosophy:** Easy to Configure

---

### 15. `EventLogEntry` builder with validation
The current builder functions (`createProcessStartEvent`, etc.) are good but return plain objects. A fluent builder with chainable methods and build-time validation would match the Java SDK's `EventLogEntry.builder()` pattern:
```typescript
const event = EventLogEntry.builder()
  .correlationId(corrId)
  .traceId(traceId)
  .applicationId('my-app')
  .targetSystem('PAYMENT')
  .originatingSystem('WEB')
  .processName('CHARGE_CARD')
  .step(1, 'Authorize Payment')
  .status(EventStatus.SUCCESS)
  .summary('Charged $100')
  .result('AUTHORIZED')
  .executionTimeMs(350)
  .build();  // Throws if required fields missing
```

**Philosophy:** Easy to Use

---

### 16. Request/response payload size guard
Add a configurable max payload size (default 32KB) that truncates `request_payload` and `response_payload` before queuing. Prevents accidentally logging massive payloads that bloat the queue, slow down sends, and get rejected by the API.

```typescript
const logger = new AsyncEventLogger({
  client,
  maxPayloadSize: 32_768,  // bytes, truncate with "[TRUNCATED]" suffix
});
```

**Philosophy:** Non-Blocking (prevent oversized payloads from degrading throughput)

---

## Summary

| # | Enhancement | Philosophy | Priority |
|---|---|---|---|
| 1 | Fix retry sleep blocking queue | Non-Blocking | P0 |
| 2 | Fix signal handler accumulation | Easy to Use | P0 |
| 3 | Fix `flush()` passive spin loop | Non-Blocking | P0 |
| 4 | Fix linear backoff mislabeled as exponential | Easy to Configure | P0 |
| 5 | Batch drain (send N events per tick) | Non-Blocking | P1 |
| 6 | Replace `setInterval` with recursive `setTimeout` | Non-Blocking | P1 |
| 7 | `EventLogTemplate` with `ProcessLogger` | Easy to Use | P2 |
| 8 | `MockAsyncEventLogger` for testing | Easy to Use | P2 |
| 9 | Auto-populate `application_id` from config | Easy to Use | P2 |
| 10 | Write actual test suite | Easy to Use | P2 |
| 11 | Built-in disk spillover | Easy to Configure | P3 |
| 12 | Configurable logger interface | Easy to Configure | P3 |
| 13 | Validate events before queuing | Easy to Use | P3 |
| 14 | Lifecycle event hooks | Easy to Configure | P4 |
| 15 | Fluent `EventLogEntry` builder | Easy to Use | P4 |
| 16 | Payload size guard | Non-Blocking | P4 |
