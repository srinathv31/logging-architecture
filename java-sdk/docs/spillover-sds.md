# Spillover — Software Design Specification

## 1. Overview

The `AsyncEventLogger` includes a **disk spillover** subsystem that persists events to local JSONL files when normal delivery fails. This prevents event loss during Event Log API outages, network partitions, or sustained load.

Spillover activates automatically — no application code changes are required beyond setting a `spilloverPath`. When the API recovers, a background replay loop re-delivers spilled events without operator intervention, even if no new business requests arrive.

### When does spillover activate?

Spillover is a **last resort** before dropping an event. The SDK always tries the in-memory queue first, then retries with exponential backoff. Only when those paths are exhausted does it route to disk.

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AsyncEventLogger                             │
│                                                                     │
│  log(event)                                                         │
│      │                                                              │
│      ▼                                                              │
│  ┌─────────┐  offer()   ┌──────────────────┐  send()   ┌───────┐  │
│  │  Main    │ ────────── │   Sender Loop    │ ───────── │  API  │  │
│  │  Queue   │            │ (batch + single) │           └───┬───┘  │
│  └────┬─────┘            └──────┬───────────┘               │      │
│       │                         │                           │      │
│       │ queue full              │ failure                    │      │
│       │                         ▼                     success│      │
│       │                  ┌─────────────┐                    │      │
│       │                  │   Retry     │◄───────────────────┘      │
│       │                  │  Scheduler  │  reset consecutive        │
│       │                  └──────┬──────┘  failures                  │
│       │                         │                                   │
│       │              retries    │  exhausted / circuit open /       │
│       │              exhausted  │  requeue failed                   │
│       │                         ▼                                   │
│       │              ┌──────────────────────┐                      │
│       └─────────────►│  enqueueSpillover()  │ ◄── non-blocking    │
│                      └──────────┬───────────┘                      │
│                                 │                                   │
│                                 ▼                                   │
│                      ┌──────────────────────┐                      │
│                      │   Spillover Queue    │  in-memory buffer    │
│                      └──────────┬───────────┘                      │
│                                 │                                   │
│                                 ▼                                   │
│                      ┌──────────────────────┐                      │
│                      │   spilloverLoop()    │  background thread   │
│                      │   └─ spillToDisk()   │                      │
│                      └──────────┬───────────┘                      │
│                                 │                                   │
│                                 ▼                                   │
│                      ┌──────────────────────┐                      │
│                      │  eventlog-spillover  │                      │
│                      │       .jsonl         │  active file         │
│                      └──────────┬───────────┘                      │
│                                 │                                   │
│                        rotate   │  (atomic move)                   │
│                                 ▼                                   │
│                      ┌──────────────────────┐                      │
│                      │  eventlog-spillover  │                      │
│                      │    .replay.jsonl     │  replay snapshot     │
│                      └──────────┬───────────┘                      │
│                                 │                                   │
│                                 ▼                                   │
│                      ┌──────────────────────┐        ┌───────┐    │
│                      │    replayLoop()      │ ──────►│  API  │    │
│                      │  (scheduled timer)   │        └───────┘    │
│                      └──────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Trigger Points

Five scenarios route an event to spillover. Each corresponds to a specific code path in `AsyncEventLogger`.

| # | Trigger | Code Location | When it happens |
|---|---------|---------------|-----------------|
| 1 | **Queue full** | `log()` — `queue.offer()` returns `false` | In-memory queue at capacity and a new event arrives |
| 2 | **Retries exhausted** | `onFailure()` — `queued.attempts >= maxRetries` | Event failed all retry attempts (default: 3) |
| 3 | **Circuit breaker open** | `handleCircuitOpen()` | Consecutive failures exceeded threshold (default: 5); API considered unavailable |
| 4 | **Retry requeue failed** | `scheduleRetry()` lambda — `queue.offer(retry)` returns `false` | A retry fires but the main queue is full, so the event can't re-enter |
| 5 | **Shutdown stragglers** | `shutdownGracefully()` — drains `queue` and `pendingRetryEvents` | JVM shutdown; remaining events in the queue and pending retry set are flushed to disk |

If spillover is **disabled**, these same scenarios invoke `EventLossCallback.onEventLoss()` and increment `eventsFailed`.

## 4. Two-File Rotation Design

Spillover uses two files inside the configured `spilloverPath` directory:

| File | Purpose |
|------|---------|
| `eventlog-spillover.jsonl` | **Active file** — new events are always appended here |
| `eventlog-spillover.replay.jsonl` | **Replay snapshot** — frozen copy consumed by the replayer |

### Why two files?

A single file would create a read/write conflict: the spillover writer appends new events while the replay reader sends old ones. Splitting into two files eliminates this:

1. **Write path** (`spillToDisk`) always appends to the active file.
2. **Replay path** (`replayLoop`) atomically moves the active file to the replay file, then reads and sends from the replay file.
3. While replay is in progress, new spillover events continue appending to a fresh active file — no data loss, no contention.

### Rotation flow

```
Active file has events     Replay file doesn't exist
        │                           │
        └───────────┬───────────────┘
                    ▼
         atomic move (rename)
    active.jsonl → replay.jsonl
                    │
                    ▼
          Reset counters to 0
    (spilloverEventCount, spilloverFileSize)
                    │
                    ▼
      New spills go to fresh active.jsonl
      Replayer reads from replay.jsonl
```

## 5. Spillover Pipeline

### 5.1 `enqueueSpillover()` — Non-blocking caller

```java
private boolean enqueueSpillover(QueuedEvent queued)
```

Called from any thread (sender, retry, shutdown). Performs a non-blocking `offer()` to the in-memory `spilloverQueue`. If the spillover queue itself is full, the event is lost with reason `"spillover_queue_full"`.

This method never blocks the caller — disk I/O happens on a separate thread.

### 5.2 `spilloverLoop()` + `spillToDisk()` — Background writer

```java
private void spilloverLoop()   // runs on spilloverExecutor (single thread)
private void spillToDisk(QueuedEvent queued)
```

`spilloverLoop` polls the `spilloverQueue` and delegates each event to `spillToDisk`, which:

1. Serializes the `EventLogEntry` to JSON via Jackson (ISO-8601 dates, unknown properties ignored).
2. Computes the UTF-8 byte size of the JSON line (including the trailing newline).
3. Acquires `spillReplayLock` and checks limits:
   - `spilloverEventCount >= maxSpilloverEvents` → drop with reason `"spillover_max_events"`
   - `spilloverFileSize + lineBytes > maxSpilloverSizeBytes` → drop with reason `"spillover_max_size"`
4. Appends the line to `eventlog-spillover.jsonl` using `Files.write(..., CREATE, APPEND)`.
5. Increments `spilloverEventCount` and `spilloverFileSize` atomically.
6. Increments the `eventsSpilled` metric counter.

### 5.3 `replayLoop()` — Scheduled replayer

```java
private void replayLoop()   // runs on replayExecutor (ScheduledExecutorService)
```

Invoked at a fixed interval (default: every 10 seconds via `scheduleWithFixedDelay`). Steps:

1. **Guard / reset check**:
   - If the circuit breaker is open **and reset timeout has not elapsed**, return immediately.
   - If the circuit breaker is open **and reset timeout has elapsed**, call `resetCircuit()` and continue replay in the same cycle.
2. **Rotate**: Under `spillReplayLock`, if no replay file exists and the active file is non-empty, atomically move `active → replay` and reset counters to 0.
3. **Read**: Read all lines from the replay file.
4. **Send**: For each non-blank line:
   - Deserialize from JSON to `EventLogEntry`.
   - Call `client.createEvent(event)` synchronously.
   - On success: increment `eventsReplayed`.
   - On `IOException` (corrupt line): log a warning and skip.
   - On any other exception (API failure): stop replay for this cycle.
5. **Cleanup**: Under `spillReplayLock`:
   - If all lines were sent, delete the replay file.
   - If some remain, rewrite the replay file with only the unsent lines (using a temp file + atomic move).

## 6. Safety Mechanisms

### `spillReplayLock`

A `synchronized` object lock that coordinates between the writer (`spillToDisk`) and the replayer (`replayLoop`). Protects:
- The file rotation (active → replay) from racing with a concurrent append.
- The counter reset from racing with an increment.
- The replay file rewrite from racing with a delete.

### Atomic file moves

File rotation uses `StandardCopyOption.ATOMIC_MOVE` for a rename-based move that is crash-safe on most filesystems. If the OS doesn't support atomic moves, it falls back to `REPLACE_EXISTING`.

Replay file rewrites follow the same pattern: write to a `.tmp` file first, then atomically replace the replay file. If the atomic move fails, the temp file is cleaned up.

### UTF-8 byte sizing

`spillToDisk` computes `lineBytes` using `String.getBytes(StandardCharsets.UTF_8).length` before appending. The `maxSpilloverSizeBytes` limit is enforced against the running total in `spilloverFileSize`, ensuring the spillover file doesn't grow beyond the configured cap regardless of character encoding.

### Startup counter recovery

On construction, if an active spillover file already exists (from a previous JVM crash), the constructor reads it, counts non-blank lines, and initializes `spilloverEventCount` and `spilloverFileSize`. This prevents the new instance from exceeding limits on a file it inherited.

### Corrupt line handling

During replay, a JSON deserialization failure (`IOException`) is treated as a corrupt line — it is logged and skipped rather than blocking replay of subsequent events. The `sent` counter still increments so the line is removed from the replay file on rewrite.

## 7. Configuration

### Spring Boot YAML

All spillover properties live under `eventlog.async.*`. Full reference with defaults:

```yaml
eventlog:
  enabled: true
  base-url: https://your-eventlog-api.example.com
  async:
    enabled: true                        # default: true
    queue-capacity: 10000                # default: 10,000 — main in-memory queue size
    max-retries: 3                       # default: 3 — retry attempts before spillover
    base-retry-delay-ms: 1000           # default: 1,000ms — base delay for exponential backoff
    max-retry-delay-ms: 30000           # default: 30,000ms — cap on retry delay
    circuit-breaker-threshold: 5        # default: 5 — consecutive failures to open circuit
    circuit-breaker-reset-ms: 30000     # default: 30,000ms — time before circuit resets
    spillover-path: ./spillover          # default: null (disabled) — directory for JSONL files
    replay-interval-ms: 10000           # default: 10,000ms — how often replay runs
    max-spillover-events: 10000         # default: 10,000 — max events in active file
    max-spillover-size-mb: 50           # default: 50 — max active file size in MB
    virtual-threads: false              # default: false — use Java 21 virtual threads
    batch-size: 50                      # default: 50 — events per batch send
    sender-threads: 1                   # default: 1 — parallel sender threads
    max-batch-wait-ms: 100              # default: 100ms — wait for batch to fill
```

### Programmatic (Builder API)

```java
AsyncEventLogger logger = AsyncEventLogger.builder()
    .client(eventLogClient)
    .spilloverPath(Path.of("./spillover"))
    .maxSpilloverEvents(10_000)
    .maxSpilloverSizeBytes(50L * 1024 * 1024)  // 50 MB
    .replayIntervalMs(10_000)
    .build();
```

Setting `spilloverPath` to a non-null value enables the entire spillover subsystem. The directory is created automatically if it doesn't exist.

## 8. Metrics & Observability

### Micrometer gauges

When `eventlog.metrics.enabled=true` (default) and Micrometer is on the classpath, `EventLogMetricsBinder` registers these gauges:

| Metric Name | Description | Spillover relevance |
|-------------|-------------|---------------------|
| `eventlog.events.queued` | Total events accepted into the main queue | Baseline — compare to sent + spilled |
| `eventlog.events.sent` | Total events successfully delivered | Should converge with queued over time |
| `eventlog.events.failed` | Total events permanently lost | Usually low with spillover enabled; rises when spillover queue/file limits are exceeded |
| `eventlog.events.spilled` | Total events written to spillover disk | Indicates API outage severity |
| `eventlog.events.replayed` | Total events replayed from disk | Should converge with spilled after recovery |
| `eventlog.queue.depth` | Current in-memory queue size | Spikes before spillover activates |
| `eventlog.circuit-breaker.open` | Circuit breaker state (1=open, 0=closed) | Open state triggers spillover for all events |

### `EventLossCallback` reason strings

When an event is dropped (even with spillover enabled, e.g. when the spillover queue itself is full), the `EventLossCallback` is invoked with one of these reason strings:

| Reason | Meaning |
|--------|---------|
| `queue_full` | Main queue full, spillover disabled |
| `retries_exhausted` | All retries failed, spillover disabled |
| `retry_requeue_failed` | Retry couldn't re-enter main queue, spillover disabled |
| `retry_executor_rejected` | Retry executor shut down, couldn't schedule retry |
| `shutdown_in_progress` | `log()` called after shutdown was requested |
| `shutdown_pending_retry` | Pending retry claimed during shutdown, spillover disabled |
| `spillover_queue_full` | Spillover in-memory queue is full |
| `spillover_max_events` | Active spillover file hit `maxSpilloverEvents` limit |
| `spillover_max_size` | Active spillover file hit `maxSpilloverSizeBytes` limit |

## 9. Lifecycle

### Startup sequence

1. Constructor validates builder parameters.
2. If `spilloverPath` is set:
   - Create the spillover directory (`Files.createDirectories`).
   - Read any existing `eventlog-spillover.jsonl` to recover `spilloverEventCount` and `spilloverFileSize`.
   - Create `spilloverQueue` (same capacity as main queue).
   - Create `spilloverExecutor` (single thread, daemon).
   - Create `replayExecutor` (single-thread scheduled, daemon).
3. Start sender loop(s) on `senderExecutor`.
4. Start `spilloverLoop` on `spilloverExecutor`.
5. Schedule `replayLoop` on `replayExecutor` at `replayIntervalMs` fixed delay.
6. Register JVM shutdown hook (unless `registerShutdownHook=false`, e.g. Spring manages lifecycle).

### Graceful shutdown sequence

1. Set `shutdownRequested = true` (prevents new `log()` calls).
2. `shutdownNow()` the retry executor — cancels pending retry tasks.
3. Wait up to 10 seconds for sender threads to drain the main queue.
4. Iterate `pendingRetryEvents` and route each to spillover (or `EventLossCallback` if disabled).
5. Drain any remaining main queue events to spillover.
6. `shutdownNow()` the sender executor and replay executor.
7. `shutdown()` the spillover executor (graceful — waits up to 10s for remaining disk writes).
8. Log final metrics summary.

In Spring Boot, `EventLogShutdown` (a `@PreDestroy` bean) calls `shutdown()` instead of the JVM hook, ensuring orderly shutdown within the Spring lifecycle.

## 10. JSONL File Format

Each line in the spillover file is a complete JSON object representing one `EventLogEntry`. Fields use camelCase and ISO-8601 timestamps:

```jsonl
{"applicationId":"pet-resort-api","correlationId":"a1b2c3d4","processName":"CreateBooking","processStatus":"PROCESS_START","step":"BookingCreated","details":"Booking BK-20260601-001 created for PET-001","targetSystem":"PET_RESORT","originatingSystem":"PET_RESORT","timestamp":"2026-06-01T10:15:30.123Z","userId":"system"}
{"applicationId":"pet-resort-api","correlationId":"a1b2c3d4","processName":"CreateBooking","processStatus":"PROCESS_END","step":"BookingCompleted","details":"Booking BK-20260601-001 completed successfully","targetSystem":"PET_RESORT","originatingSystem":"PET_RESORT","timestamp":"2026-06-01T10:15:30.456Z","userId":"system"}
```

Jackson configuration:
- `JavaTimeModule` registered for ISO-8601 date serialization.
- `WRITE_DATES_AS_TIMESTAMPS` disabled (produces string dates, not epoch numbers).
- `FAIL_ON_UNKNOWN_PROPERTIES` disabled (forward-compatible deserialization on replay).

## 11. Demo Reference

The `pet-resort-api` includes an interactive demo script that exercises the full spillover lifecycle:

```
pet-resort-api/scripts/spillover-demo.sh
```

The demo walks through 6 phases:

1. **Setup checks** — verifies Pet Resort API (`:8081`), Event Log API (`:3000`), and `jq` are available.
2. **Normal flow** — creates bookings, check-ins, room service, and check-outs while both APIs are running. Dashboard shows `queued ≈ sent`, zero failures.
3. **Spillover trigger** — stops the Event Log API, fires 15 rapid bookings (~75 events). Dashboard shows circuit breaker opening, `eventsSpilled` climbing, and `eventsFailed` typically staying low while spillover has capacity.
4. **Recovery** — restarts the Event Log API. Circuit breaker resets after ~30s and replay runs on the background interval (default: 10s), re-delivering spilled events without requiring new business traffic. `eventsReplayed` increments.
5. **Aggressive config** — suggests lowering `queue-capacity` to 10 and `circuit-breaker-threshold` to 2 for faster spillover triggering.
6. **Summary** — displays a final metrics table comparing pre- and post-spillover state.

### Prerequisites

```bash
# Terminal 1: Event Log API
cd api && pnpm dev

# Terminal 2: Pet Resort API
cd pet-resort-api && mvn spring-boot:run

# Terminal 3: Run the demo
cd pet-resort-api && bash scripts/spillover-demo.sh
```

### Pet Resort application.yml (spillover config)

```yaml
eventlog:
  async:
    spillover-path: ./spillover
    replay-interval-ms: 10000
    max-spillover-events: 10000
    max-spillover-size-mb: 50
```

## Source Files

| File | Role |
|------|------|
| [`AsyncEventLogger.java`](../eventlog-sdk/src/main/java/com/eventlog/sdk/client/AsyncEventLogger.java) | All spillover logic (enqueue, write, rotate, replay) |
| [`EventLossCallback.java`](../eventlog-sdk/src/main/java/com/eventlog/sdk/client/EventLossCallback.java) | Callback interface for dropped events |
| [`EventLogProperties.java`](../eventlog-spring-boot-starter/src/main/java/com/eventlog/sdk/autoconfigure/EventLogProperties.java) | Spring Boot property bindings (`eventlog.async.*`) |
| [`EventLogAutoConfiguration.java`](../eventlog-spring-boot-starter/src/main/java/com/eventlog/sdk/autoconfigure/EventLogAutoConfiguration.java) | Bean wiring (passes spillover config to builder) |
| [`EventLogMetricsBinder.java`](../eventlog-spring-boot-starter/src/main/java/com/eventlog/sdk/autoconfigure/EventLogMetricsBinder.java) | Micrometer gauge registration |
| [`architecture.md`](./architecture.md) | High-level architecture diagram |
