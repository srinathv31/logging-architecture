---
title: Circuit Breaker Configuration
impact: HIGH
impactDescription: prevents cascading failures when the API is unavailable
tags: resilience, circuit-breaker, threshold, reset
---

## Circuit Breaker Configuration

The circuit breaker opens after N consecutive failures, routing events to spillover instead of continuing to hit an unavailable API. It resets after a configured timeout, allowing traffic to resume.

**Incorrect (threshold too low — opens on transient errors):**

```yaml
eventlog:
  async:
    circuit-breaker-threshold: 1   # Opens on a single failure
    circuit-breaker-reset-ms: 5000  # Resets too quickly, causing flapping
```

**Correct (balanced threshold and reset):**

```yaml
eventlog:
  async:
    circuit-breaker-threshold: 5
    circuit-breaker-reset-ms: 30000
```

**Monitoring via Micrometer:**

```bash
curl http://localhost:8080/actuator/metrics/eventlog.circuit-breaker.open
# value: 1 = open, 0 = closed
```

Available metrics:

| Metric | Description |
|--------|-------------|
| eventlog.events.queued | Events accepted into main queue |
| eventlog.events.sent | Events successfully delivered |
| eventlog.events.failed | Events permanently lost |
| eventlog.events.spilled | Events written to spillover disk |
| eventlog.events.replayed | Events replayed from disk |
| eventlog.queue.depth | Current in-memory queue size |
| eventlog.circuit-breaker.open | Circuit breaker state |

If the circuit breaker opens frequently:

- Increase the threshold to tolerate more transient failures
- Verify API availability and network connectivity
- Check for 5xx or 429 responses indicating server-side issues
- Ensure spillover is configured so events are not lost while the circuit is open
