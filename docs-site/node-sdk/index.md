---
title: Node SDK
---

# Event Log SDK for TypeScript

TypeScript/JavaScript SDK for the Event Log API v1.4 — centralized event logging for distributed systems.

## Features

- **AsyncEventLogger** — fire-and-forget logging with retry and circuit breaker
- **OAuth client credentials** authentication with token caching
- **Typed event builders** — helper functions for properly structured events
- **Batch operations** for bulk event creation
- **Fork-join pattern** with span links for parallel workflows
- **Correlation links** for account-to-correlation mapping

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
- [AsyncEventLogger](/node-sdk/core/async-event-logger) — fire-and-forget logging
- [Event Builders](/node-sdk/core/event-builders) — helper functions
- [Error Handling](/node-sdk/error-handling) — EventLogError handling
