---
title: Auto-Configuration
---

# Spring Boot Auto-Configuration

The Spring Boot starter enables auto-wiring of all Event Log SDK beans.

## Dependency

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

## Example Configuration

```yaml
eventlog:
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: my-service
  # transport: webclient | restclient | jdk (auto-select if omitted)
  transport: webclient
  connect-timeout: 10s
  request-timeout: 30s
  max-retries: 3
  retry-delay: 500ms

  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read

  async:
    enabled: true
    queue-capacity: 10000
    virtual-threads: true
    # executor: virtual | spring | <bean-name>
```

## Transport Selection

By default the starter auto-selects the best available transport:

- `WebClient` (if `spring-webflux` is on the classpath)
- `RestClient` (if `spring-web` is on the classpath)
- JDK `HttpClient` (fallback)

Override with `eventlog.transport`:

- `webclient` for non-blocking async
- `restclient` for synchronous HTTP with virtual threads
- `jdk` for pure JDK transport

## Auto-Configured Beans

The starter automatically registers these beans when `eventlog.enabled=true`:

| Bean | Description |
|------|-------------|
| `EventLogClient` | Synchronous HTTP client |
| `AsyncEventLogger` | Fire-and-forget async logger |
| `EventLogTemplate` | Fluent convenience API (if `application-id` or `spring.application.name` is set) |
| `OAuthTokenProvider` | OAuth client (if `eventlog.oauth.token-url` is set) |

## Bean Injection Example

```java
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.template.EventLogTemplate;
import com.eventlog.sdk.template.EventLogTemplate.ProcessLogger;
import org.springframework.stereotype.Service;

@Service
public class OrderService {
    private final EventLogTemplate template;

    public OrderService(EventLogTemplate template) {
        this.template = template;
    }

    public void processOrder(Order order) {
        // correlationId/traceId read from MDC automatically
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .addIdentifier("orderId", order.getId());

        process.logStep(1, "Validate Order", EventStatus.SUCCESS, "Order validated");
    }
}
```

## Validation

The starter uses Bean Validation to fail fast on missing `eventlog.base-url` and incomplete OAuth settings. Validation runs when `spring-boot-starter-validation` is on the classpath (included by default). If you exclude it, these checks will not run.

## Profile-Aware Defaults

If the active profile includes `dev`, `local`, or `test`, the SDK uses shorter timeouts unless explicitly configured:

| Property | Production Default | Dev/Local/Test Default |
|----------|-------------------|----------------------|
| `connect-timeout` | `10s` | `3s` |
| `request-timeout` | `30s` | `10s` |
| `retry-delay` | `500ms` | `200ms` |
| `async.base-retry-delay-ms` | `1000` | `500` |
| `async.max-retry-delay-ms` | `30000` | `5000` |
