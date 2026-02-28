---
title: Spillover
---

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

| # | Trigger | When it happens |
|---|---------|-----------------|
| 1 | **Queue full** | In-memory queue at capacity and a new event arrives |
| 2 | **Retries exhausted** | Event failed all retry attempts (default: 3) |
| 3 | **Circuit breaker open** | Consecutive failures exceeded threshold (default: 5); API considered unavailable |
| 4 | **Retry requeue failed** | A retry fires but the main queue is full, so the event can't re-enter |
| 5 | **Shutdown stragglers** | JVM shutdown; remaining events in the queue and pending retry set are flushed to disk |

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

## 5. Configuration

### Spring Boot YAML

```yaml
eventlog:
  async:
    spillover-path: ./spillover          # default: null (disabled)
    replay-interval-ms: 10000           # default: 10,000ms
    max-spillover-events: 10000         # default: 10,000
    max-spillover-size-mb: 50           # default: 50 MB
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

## 6. Metrics & Observability

### Micrometer Gauges

When `eventlog.metrics.enabled=true` (default) and Micrometer is on the classpath:

| Metric Name | Description |
|-------------|-------------|
| `eventlog.events.queued` | Total events accepted into the main queue |
| `eventlog.events.sent` | Total events successfully delivered |
| `eventlog.events.failed` | Total events permanently lost |
| `eventlog.events.spilled` | Total events written to spillover disk |
| `eventlog.events.replayed` | Total events replayed from disk |
| `eventlog.queue.depth` | Current in-memory queue size |
| `eventlog.circuit-breaker.open` | Circuit breaker state (1=open, 0=closed) |

### EventLossCallback Reasons

When an event is dropped, the `EventLossCallback` is invoked with one of these reason strings:

| Reason | Meaning |
|--------|---------|
| `queue_full` | Main queue full, spillover disabled |
| `retries_exhausted` | All retries failed, spillover disabled |
| `retry_requeue_failed` | Retry couldn't re-enter main queue, spillover disabled |
| `retry_executor_rejected` | Retry executor shut down |
| `shutdown_in_progress` | `log()` called after shutdown was requested |
| `shutdown_pending_retry` | Pending retry claimed during shutdown, spillover disabled |
| `spillover_queue_full` | Spillover in-memory queue is full |
| `spillover_max_events` | Active spillover file hit `maxSpilloverEvents` limit |
| `spillover_max_size` | Active spillover file hit `maxSpilloverSizeBytes` limit |

## 7. Lifecycle

### Startup Sequence

1. Constructor validates builder parameters.
2. If `spilloverPath` is set: create directory, recover existing spillover file counters, start spillover and replay executors.
3. Start sender loop(s) on `senderExecutor`.
4. Schedule `replayLoop` at `replayIntervalMs` fixed delay.
5. Register JVM shutdown hook (unless `registerShutdownHook=false`, e.g. Spring manages lifecycle).

### Graceful Shutdown

1. Set `shutdownRequested = true` (prevents new `log()` calls).
2. Cancel pending retry tasks.
3. Wait up to 10 seconds for sender threads to drain the main queue.
4. Route remaining queue and pending retry events to spillover.
5. Shut down all executors.
6. Log final metrics summary.

In Spring Boot, `EventLogShutdown` (`@PreDestroy`) calls `shutdown()` instead of the JVM hook.

## 8. JSONL File Format

Each line in the spillover file is a complete JSON object representing one `EventLogEntry`:

```jsonl
{"applicationId":"pet-resort-api","correlationId":"a1b2c3d4","processName":"CreateBooking",...}
{"applicationId":"pet-resort-api","correlationId":"a1b2c3d4","processName":"CreateBooking",...}
```

Jackson configuration:
- `JavaTimeModule` registered for ISO-8601 date serialization
- `WRITE_DATES_AS_TIMESTAMPS` disabled (produces string dates)
- `FAIL_ON_UNKNOWN_PROPERTIES` disabled (forward-compatible deserialization)
