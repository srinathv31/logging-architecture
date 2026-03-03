---
title: Application YAML Guide
---

# Application YAML Guide

A complete, copy-paste-ready `application.yml` for Spring Boot projects using the Event Log SDK.

## Prerequisites

Your `pom.xml` must include the SDK starter and actuator for metrics:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.yourcompany.eventlog</groupId>
            <artifactId>eventlog-sdk-bom</artifactId>
            <version>1.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <!-- Event Log SDK starter -->
    <dependency>
        <groupId>com.yourcompany.eventlog</groupId>
        <artifactId>eventlog-spring-boot-starter</artifactId>
    </dependency>

    <!-- Required for @LogEvent annotation support -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-aop</artifactId>
    </dependency>

    <!-- Required for metrics via /actuator/metrics -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
</dependencies>
```

## Complete YAML Example

This is a production-ready configuration based on the [Pet Resort API](/pet-resort/) reference application. Copy it into your `application.yml` and adjust the values to match your environment.

```yaml
spring:
  application:
    name: my-service

# ──────────────────────────────────────────────
# Event Log SDK
# ──────────────────────────────────────────────
eventlog:
  enabled: true
  base-url: http://localhost:3000                # Event Log API URL
  application-id: my-service                     # identifies this app in traces
  target-system: MY_SERVICE                      # downstream system name
  originating-system: MY_SERVICE                 # upstream caller name

  # --- Authentication ---
  api-key: local-dev-key                         # simple auth for dev/test

  # For production, replace api-key with OAuth:
  # oauth:
  #   token-url: https://auth.example.com/oauth/token
  #   client-id: my-client
  #   client-secret: ${EVENTLOG_CLIENT_SECRET}
  #   scope: eventlog:write eventlog:read

  # --- Transport ---
  transport: jdk                                 # jdk | webclient | restclient
                                                 # omit for auto-selection

  # --- Async Processing ---
  async:
    enabled: true
    queue-capacity: 1000                         # in-memory queue size
    virtual-threads: true                        # requires Java 21+

    # Spillover — persists events to disk when the API is unavailable
    spillover-path: ./spillover                  # set to enable disk spillover
    replay-interval-ms: 10000                    # how often to replay spilled events (ms)
    max-spillover-events: 10000                  # max events per spillover file
    max-spillover-size-mb: 50                    # max spillover file size (MB)

  # --- Annotation Support ---
  annotation:
    enabled: true                                # enables @LogEvent AOP

  # --- MDC Filter ---
  mdc-filter:
    url-patterns: "/api/*"                       # URL patterns for MDC propagation filter

# ──────────────────────────────────────────────
# Actuator — exposes SDK metrics
# ──────────────────────────────────────────────
management:
  endpoints:
    web:
      exposure:
        include: health,metrics                  # expose health + metrics endpoints
      cors:
        allowed-origins: "*"
        allowed-methods: GET
  endpoint:
    health:
      show-details: always                       # include SDK health indicators

# ──────────────────────────────────────────────
# Logging — SDK debug output
# ──────────────────────────────────────────────
logging:
  level:
    com.eventlog.sdk: DEBUG                      # SDK internals (queue, retry, spillover)
```

## Section-by-Section Breakdown

### Core Properties

```yaml
eventlog:
  enabled: true
  base-url: http://localhost:3000
  application-id: my-service
  target-system: MY_SERVICE
  originating-system: MY_SERVICE
```

| Property | Purpose |
|----------|---------|
| `enabled` | Master switch — set to `false` to disable all SDK beans |
| `base-url` | URL of the Event Log API. Required when enabled |
| `application-id` | Identifies this application in event traces. Falls back to `spring.application.name` |
| `target-system` | The downstream system this service calls (appears in event metadata) |
| `originating-system` | The upstream system that initiated the request |

### Authentication

**Development** — use an API key for simplicity:

```yaml
eventlog:
  api-key: local-dev-key
```

**Production** — use OAuth client credentials:

```yaml
eventlog:
  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read
```

See [OAuth Provider](/java-sdk/core/oauth) for full details including token refresh and timeout configuration.

### Transport

```yaml
eventlog:
  transport: jdk
```

The SDK auto-selects the best available transport if omitted:

| Value | Library | Best for |
|-------|---------|----------|
| `webclient` | Spring WebFlux `WebClient` | Non-blocking reactive apps |
| `restclient` | Spring 6 `RestClient` | Synchronous apps with virtual threads |
| `jdk` | JDK `HttpClient` | No Spring Web dependency needed |

See [Auto-Configuration](/java-sdk/spring-boot/auto-configuration#transport-selection) for selection details.

### Async Processing & Spillover

```yaml
eventlog:
  async:
    enabled: true
    queue-capacity: 1000
    virtual-threads: true
    spillover-path: ./spillover
    replay-interval-ms: 10000
    max-spillover-events: 10000
    max-spillover-size-mb: 50
```

| Property | Purpose |
|----------|---------|
| `queue-capacity` | Size of the in-memory event queue. Events exceeding this spill to disk |
| `virtual-threads` | Use Java 21 virtual threads for async processing |
| `spillover-path` | Directory for disk persistence. Omit to disable spillover |
| `replay-interval-ms` | How often the replay loop retries spilled events |
| `max-spillover-events` | Cap on events per spillover file before dropping |
| `max-spillover-size-mb` | Cap on spillover file size before dropping |

See [Spillover](/java-sdk/advanced/spillover) for the full architecture and trigger conditions.

### Annotation Support

```yaml
eventlog:
  annotation:
    enabled: true
```

When enabled, the `@LogEvent` annotation automatically logs method entry/exit as event steps. Requires `spring-boot-starter-aop` on the classpath.

See [@LogEvent Annotation](/java-sdk/spring-boot/annotations) for usage details.

### MDC Filter

```yaml
eventlog:
  mdc-filter:
    url-patterns: "/api/*"
```

Registers a servlet filter that populates SLF4J MDC with `correlationId`, `traceId`, and `spanId` for matching URL patterns. The SDK reads these MDC values automatically — no manual propagation needed.

Multiple patterns can be specified as a comma-separated list:

```yaml
eventlog:
  mdc-filter:
    url-patterns: "/api/*,/webhook/*"
```

## Metrics & Actuator

The SDK publishes Micrometer gauges automatically when `spring-boot-starter-actuator` is on the classpath and `eventlog.metrics.enabled=true` (the default).

### Exposing the Metrics Endpoint

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics
```

### Available SDK Gauges

| Metric | Description |
|--------|-------------|
| `eventlog.events.queued` | Total events accepted into the main queue |
| `eventlog.events.sent` | Total events successfully delivered |
| `eventlog.events.failed` | Total events permanently lost |
| `eventlog.events.spilled` | Total events written to spillover disk |
| `eventlog.events.replayed` | Total events replayed from disk |
| `eventlog.queue.depth` | Current in-memory queue size |
| `eventlog.circuit-breaker.open` | Circuit breaker state (1 = open, 0 = closed) |

### Querying Metrics

List all SDK metrics:

```bash
curl http://localhost:8080/actuator/metrics | jq '.names[]' | grep eventlog
```

Query a specific metric:

```bash
curl http://localhost:8080/actuator/metrics/eventlog.events.sent
```

Example response:

```json
{
  "name": "eventlog.events.sent",
  "measurements": [
    { "statistic": "VALUE", "value": 142.0 }
  ]
}
```

### Custom Application Gauges

You can register your own Micrometer gauges alongside the SDK's built-in metrics. Here's an example from the Pet Resort API:

```java
@Configuration
public class MyMetricsConfig {

    public MyMetricsConfig(MyStore store, MeterRegistry registry) {
        Gauge.builder("myapp.items.active", store, s ->
                s.findAll().stream()
                    .filter(item -> item.getStatus() == Status.ACTIVE)
                    .count())
            .description("Active items in the system")
            .register(registry);
    }
}
```

These custom gauges appear alongside SDK gauges on the `/actuator/metrics` endpoint.

### Debug Logging

```yaml
logging:
  level:
    com.eventlog.sdk: DEBUG
```

Enables detailed logs for SDK internals including queue operations, retry attempts, spillover writes, and circuit breaker state changes. Set to `INFO` in production.

## Minimal vs. Full Configuration

**Minimal** — 3 lines to get started:

```yaml
eventlog:
  enabled: true
  base-url: http://localhost:3000
  api-key: dev-key
```

This uses all defaults: auto-selected transport, async enabled with 10,000-element queue, no spillover, no MDC filter.

**Full production** — the complete example at the top of this page adds:
- OAuth authentication (instead of API key)
- Explicit transport selection
- Spillover with disk persistence
- MDC filter for automatic context propagation
- `@LogEvent` annotation support
- Actuator metrics exposure
- SDK debug logging

## Next Steps

- [Auto-Configuration](/java-sdk/spring-boot/auto-configuration) — beans registered by the starter
- [Configuration Reference](/java-sdk/spring-boot/configuration) — full property table with types and defaults
- [Spillover](/java-sdk/advanced/spillover) — disk persistence architecture
- [Troubleshooting](/java-sdk/troubleshooting) — common issues and solutions
