---
title: HTTP Transport Selection
impact: HIGH
impactDescription: wrong transport choice affects performance and compatibility
tags: config, transport, webclient, restclient, jdk
---

## HTTP Transport Selection

The SDK auto-selects the best available HTTP transport based on your classpath. Forcing a transport that is not backed by the correct dependency causes runtime failures.

Auto-selection order:

1. **WebClient** (if `spring-webflux` on classpath) — non-blocking async
2. **RestClient** (if `spring-web` on classpath) — synchronous with virtual threads
3. **JDK HttpClient** (fallback) — no Spring dependency needed

Override with: `eventlog.transport: webclient | restclient | jdk`

**Incorrect (forcing webclient without the dependency):**

```yaml
# spring-webflux is NOT on the classpath
eventlog:
  transport: webclient
  # Fails at startup: No qualifying bean of type 'WebClient.Builder'
```

**Correct (match transport to your application type):**

```yaml
# For reactive apps (spring-webflux on classpath):
eventlog:
  transport: webclient

# For traditional Spring MVC with virtual threads:
eventlog:
  transport: restclient

# For minimal dependency footprint:
eventlog:
  transport: jdk
```

In most cases, let auto-selection handle this. Only override the transport when you have a specific reason, such as forcing `jdk` in a non-Spring application or preferring `restclient` in an app that has webflux on the classpath for other reasons.
