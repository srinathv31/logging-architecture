---
title: AsyncEventLogger
---

# AsyncEventLogger

The background engine that powers both `EventLogTemplate` and `@LogEvent`. Handles fire-and-forget delivery with automatic retry, circuit breaker, and disk spillover. In Spring Boot, this bean is auto-configured — you rarely interact with it directly.

## Features

| Feature | Description |
|---------|-------------|
| **Fire-and-forget** | `log()` returns immediately, never blocks |
| **Automatic retry** | Failed events retry with exponential backoff |
| **Circuit breaker** | Stops hammering API when it's down |
| **Graceful shutdown** | Flushes pending events on JVM shutdown |
| **Spillover to disk** | Saves events to file when API unreachable |

## Creating an Instance

```java
AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .queueCapacity(10_000)           // Buffer size
    .maxRetries(3)                    // Retry attempts
    .baseRetryDelayMs(1000)          // Initial retry delay
    .maxRetryDelayMs(30_000)         // Max retry delay
    .circuitBreakerThreshold(5)       // Failures before circuit opens
    .circuitBreakerResetMs(30_000)    // Time before circuit resets
    .spilloverPath(Path.of("/var/log/spillover"))  // Disk backup
    .build();
```

## Usage

```java
String correlationId = createCorrelationId("auth");
String traceId = createTraceId();

// Log a step event (returns immediately)
eventLog.log(step(correlationId, traceId, "MY_PROCESS", 1, "Identity Check")
    .eventStatus(EventStatus.SUCCESS)
    .summary("Identity verified")
    .build());

// Check metrics
System.out.println(eventLog.getMetrics());
// Metrics{queued=1, sent=1, failed=0, spilled=0, depth=0, circuitOpen=false}
```

## Thread Safety

`AsyncEventLogger` is fully thread-safe. A single instance should be shared across the application.

`log(event)` runs on the **caller's thread** and does only a non-blocking `queue.offer()` — no I/O, no waiting. All other work happens on background daemon threads.

## Metrics

The `getMetrics()` method returns current state:

| Metric | Description |
|--------|-------------|
| `queued` | Total events accepted into the queue |
| `sent` | Total events successfully delivered |
| `failed` | Total events permanently lost |
| `spilled` | Total events written to spillover disk |
| `replayed` | Total events replayed from disk |
| `depth` | Current queue size |
| `circuitOpen` | Whether the circuit breaker is open |

## Spring Boot

With the Spring Boot starter, `AsyncEventLogger` is auto-configured. Just inject it:

```java
@Service
public class OrderService {
    private final AsyncEventLogger eventLog;

    public OrderService(AsyncEventLogger eventLog) {
        this.eventLog = eventLog;
    }
}
```

Configure via `application.yml`:

```yaml
eventlog:
  async:
    enabled: true
    queue-capacity: 10000
    max-retries: 3
    circuit-breaker-threshold: 5
    spillover-path: ./spillover
    virtual-threads: true
```

## Related

- [Architecture](/java-sdk/advanced/architecture) — threading model and data flow
- [Spillover](/java-sdk/advanced/spillover) — disk persistence design
- [Configuration Reference](/java-sdk/spring-boot/configuration) — full property table
