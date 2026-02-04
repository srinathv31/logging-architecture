# Architecture Overview

```mermaid
flowchart LR
    app[Application Code]
    logger[AsyncEventLogger]
    queue[(In-Memory Queue)]
    sender[Sender Loop]
    retry[Retry Scheduler]
    transport[HTTP Transport]
    api[Event Log API]
    spill[(Spillover Files)]

    app --> logger
    logger --> queue
    queue --> sender
    sender --> transport
    transport --> api

    sender --> retry
    retry --> queue

    sender -. circuit open .-> spill
    queue -. queue full .-> spill
```

## Notes

- The sender loop drains the queue and sends events to the API.
- Retry scheduling applies exponential backoff with jitter.
- Circuit breaker pauses sends after repeated failures.
- Spillover writes events to disk when enabled and the queue is full or API is down.
