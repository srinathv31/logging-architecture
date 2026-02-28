---
title: Migration Guide
---

# Migration Guide (Manual SDK -> Spring Boot Starter)

This guide covers migrating from manual SDK setup to the Spring Boot starter.

## 1. Add the Spring Boot Starter

Replace the core dependency with the starter in your Spring Boot application:

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

## 2. Remove Manual Bean Construction

Delete or disable code that manually constructs:
- `EventLogClient`
- `AsyncEventLogger`
- `OAuthTokenProvider`

Example to remove:

```java
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.example.com")
    .tokenProvider(tokenProvider)
    .build();

AsyncEventLogger logger = AsyncEventLogger.builder()
    .client(client)
    .registerShutdownHook(true)
    .build();
```

## 3. Configure Properties

Move builder options into `application.yml`:

```yaml
eventlog:
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: order-service
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
```

## 4. Inject the Logger

Replace manual usage with dependency injection:

```java
@Service
public class OrderService {
    private final AsyncEventLogger eventLog;

    public OrderService(AsyncEventLogger eventLog) {
        this.eventLog = eventLog;
    }
}
```

## 5. Shutdown Handling

The starter handles graceful shutdown via Spring lifecycle (`@PreDestroy`). Remove any explicit JVM shutdown hooks.

## 6. Optional: Annotation-Based Logging

Enable automatic method logging with `@LogEvent`:

```java
@LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Validate Order")
public void validateOrder(Order order) {
    // method execution logged
}
```

Disable if needed:

```yaml
eventlog:
  annotation:
    enabled: false
```
