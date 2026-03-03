---
title: "@LogEvent Annotation Configuration"
impact: MEDIUM
impactDescription: misconfigured annotation attributes lead to incorrect event data
tags: annotation, configuration, attributes, disable
---

## @LogEvent Annotation Configuration

@LogEvent attributes and how to enable/disable the annotation-based logging.

**Incorrect (assuming annotations work without the starter, not setting application-id):**

```java
// BAD: No Spring Boot starter dependency — @LogEvent silently does nothing
// BAD: No application-id configured — events have null applicationId
@LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Validate")
public void validateOrder(Order order) {
    // ...
}
```

**Correct (starter dependency included, application-id configured):**

```xml
<!-- pom.xml -->
<dependency>
    <groupId>com.yourorg</groupId>
    <artifactId>event-log-spring-boot-starter</artifactId>
    <version>${event-log.version}</version>
</dependency>
```

```yaml
# application.yml
eventlog:
  application-id: order-service
```

### Attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `process` | declaring class name | Process name |
| `step` | 0 | Step sequence number |
| `name` | method name | Step name |
| `successStatus` | SUCCESS | Status on successful execution |
| `failureStatus` | FAILURE | Status on exception |

### Disabling annotation-based logging

```yaml
eventlog:
  annotation:
    enabled: false
```

### Default behaviors

- If `process` is blank, defaults to the declaring class name.
- `applicationId` defaults to `eventlog.application-id` or `spring.application.name`.
- When Spring Cloud Config is on the classpath, Event Log beans are refresh-scoped.
