---
title: Auto-Configuration and Bean Registration
impact: HIGH
impactDescription: understanding auto-configured beans prevents duplicate/missing bean errors
tags: config, auto-configuration, beans, spring-boot
---

## Auto-Configuration and Bean Registration

The Event Log Spring Boot starter auto-configures several beans when `eventlog.enabled=true`. Understanding which beans are created and under what conditions prevents duplicate bean definitions and injection failures.

Auto-configured beans when `eventlog.enabled=true`:

| Bean | Description |
|------|-------------|
| EventLogClient | Synchronous HTTP client |
| AsyncEventLogger | Fire-and-forget async logger |
| EventLogTemplate | Fluent API (if application-id or spring.application.name is set) |
| OAuthTokenProvider | OAuth client (if oauth.token-url is set) |

**Incorrect (manually creating a bean the starter already provides):**

```java
@Configuration
public class EventLogConfig {
    @Bean
    public EventLogClient eventLogClient() {
        // WRONG — starter already creates this bean
        return EventLogClient.builder()
            .baseUrl("https://eventlog-api.example.com")
            .build();
    }
}
```

**Correct (inject the auto-configured bean directly):**

```java
@Service
public class OrderService {
    private final EventLogTemplate template;  // Auto-injected

    public OrderService(EventLogTemplate template) {
        this.template = template;
    }
}
```

Validation runs on startup: a missing `base-url` with `enabled=true` fails fast with a clear error message. Profile-aware defaults for `dev`, `local`, and `test` profiles apply shorter timeouts and relaxed settings automatically.
