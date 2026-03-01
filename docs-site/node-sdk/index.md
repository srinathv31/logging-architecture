---
title: Node SDK
---

# Event Log SDK for TypeScript

TypeScript/JavaScript SDK for the Event Log API v1.4 — centralized event logging for distributed systems.

## Features

- **EventLogTemplate + ProcessLogger** — scoped, multi-step process logging with options objects
- **AsyncEventLogger** — fire-and-forget logging with retry, circuit breaker, and spillover
- **Context propagation** — `AsyncLocalStorage`-based automatic ID propagation (Node's equivalent of Java's MDC)
- **OAuth client credentials** authentication with token caching
- **Typed event builders** — helper functions for properly structured events
- **Batch operations** for bulk event creation
- **Fork-join pattern** with span links for parallel workflows
- **Correlation links** for account-to-correlation mapping

## API Style

The Node SDK is **functionally identical** to the Java SDK — a developer familiar with one should know how to use the other. The difference is idiomatic API style:

| | Java SDK | Node SDK |
|--|---------|----------|
| **One-shot fields** | Chainable `.with*()` calls that auto-clear | `options` object passed to each emit method |
| **Construction** | Builder pattern (`.builder().build()`) | Options object (`new EventLogTemplate({ ... })`) |
| **Context** | SLF4J MDC (ThreadLocal) | AsyncLocalStorage |

See [EventLogTemplate](/node-sdk/core/event-log-template#api-style-java-vs-node) for a side-by-side comparison.

## Installation

```bash
npm install @yourcompany/eventlog-sdk
# or
yarn add @yourcompany/eventlog-sdk
```

## Version Compatibility

| SDK Version | API Version | Node.js Version |
|-------------|-------------|-----------------|
| 1.4.x       | v1.4        | 18+             |
| 1.3.x       | v1.3        | 18+             |

## Next Steps

- [Getting Started](/node-sdk/getting-started) — quick start guide
- [EventLogTemplate](/node-sdk/core/event-log-template) — scoped process logging (primary API)
- [Context Propagation](/node-sdk/core/context) — automatic ID propagation
- [AsyncEventLogger](/node-sdk/core/async-event-logger) — fire-and-forget logging
- [Event Builders](/node-sdk/core/event-builders) — helper functions
- [Error Handling](/node-sdk/error-handling) — EventLogError handling
