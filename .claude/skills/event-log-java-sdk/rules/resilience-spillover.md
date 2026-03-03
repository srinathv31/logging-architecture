---
title: Disk Spillover for Event Persistence
impact: HIGH
impactDescription: prevents event loss during API outages
tags: resilience, spillover, disk, persistence, recovery
---

## Disk Spillover for Event Persistence

Disk spillover persists events to JSONL files when delivery fails. A background replay loop re-delivers events when the API recovers. Without spillover configured, events are permanently dropped during outages.

**Incorrect (no spillover — events lost during outages):**

```yaml
eventlog:
  async:
    enabled: true
    # No spillover-path — events dropped when queue is full or API is down
```

**Correct (spillover with size limits):**

```yaml
eventlog:
  async:
    spillover-path: ./spillover
    replay-interval-ms: 10000
    max-spillover-events: 10000
    max-spillover-size-mb: 50
```

**Correct (programmatic configuration):**

```java
AsyncEventLogger logger = AsyncEventLogger.builder()
    .client(eventLogClient)
    .spilloverPath(Path.of("./spillover"))
    .maxSpilloverEvents(10_000)
    .maxSpilloverSizeBytes(50L * 1024 * 1024)
    .replayIntervalMs(10_000)
    .build();
```

Five trigger conditions cause events to spill to disk:

1. **Queue full** — in-memory queue at capacity
2. **Retries exhausted** — all retry attempts failed
3. **Circuit breaker open** — API considered unavailable
4. **Retry requeue failed** — main queue full during retry
5. **Shutdown stragglers** — JVM shutdown flushes remaining events

Two-file rotation strategy:

- `eventlog-spillover.jsonl` — active file for new events
- `eventlog-spillover.replay.jsonl` — frozen snapshot for replay

The replay loop atomically renames the active file to the replay file, processes it line by line, and deletes it when complete. This prevents duplicate delivery and ensures no events are lost during the rotation.
