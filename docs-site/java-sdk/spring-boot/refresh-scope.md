---
title: Refresh Scope
---

# Spring Cloud Config Integration

When Spring Cloud Config is on the classpath, Event Log beans are automatically refresh-scoped and reloaded on config refresh events.

## How It Works

The starter detects `spring-cloud-context` on the classpath and:

1. Registers Event Log beans with `@RefreshScope`
2. On `RefreshScopeRefreshedEvent`, beans are destroyed and recreated with updated properties
3. The `AsyncEventLogger` gracefully shuts down pending events before recreation

This allows you to update Event Log configuration (base URL, timeouts, OAuth credentials) without restarting the application.

## Disabling

If you don't want refresh-scoped beans:

```yaml
eventlog:
  refresh:
    enabled: false
```

## Example

Toggle the SDK on and off via Spring Cloud Config:

```yaml
# In your config server
eventlog:
  enabled: true   # change to false to disable at runtime
```

After pushing the config change, trigger a refresh:

```bash
curl -X POST http://localhost:8080/actuator/refresh
```

The Event Log beans will be recreated with the updated configuration.
