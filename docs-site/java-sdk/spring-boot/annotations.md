---
title: '@LogEvent Annotation'
---

# @LogEvent Annotation

Automatically log method execution time and status with the `@LogEvent` annotation.

## Usage

```java
import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.model.EventStatus;

@Service
public class OrderService {

    @LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Validate Order")
    public void validateOrder(Order order) {
        // method execution logged as a STEP event
    }

    @LogEvent(process = "ORDER_PROCESSING", step = 2, name = "Charge Card",
            successStatus = EventStatus.SUCCESS, failureStatus = EventStatus.FAILURE)
    public void chargeCard(Order order) {
        // status based on success/failure
    }
}
```

## How It Works

The annotation uses Spring AOP to intercept method calls and automatically:

1. Record the start time
2. Execute the method
3. Log a `STEP` event with execution time and status
4. On exception, log with the configured `failureStatus`

## Configuration

| Attribute | Default | Description |
|-----------|---------|-------------|
| `process` | declaring class name | Process name |
| `step` | `0` | Step sequence number |
| `name` | method name | Step name |
| `successStatus` | `SUCCESS` | Status on successful execution |
| `failureStatus` | `FAILURE` | Status on exception |

## Requirements

- Requires the Spring Boot starter dependency (AOP enabled automatically)
- `eventlog.application-id` or `spring.application.name` must be set
- Uses MDC values for correlation/trace IDs when present
- `targetSystem` and `originatingSystem` default to `applicationId` (override via `eventlog.target-system` and `eventlog.originating-system`)

## Disabling

```yaml
eventlog:
  annotation:
    enabled: false
```

## Default Behavior

- If `process` is blank, defaults to the declaring class name
- `applicationId` defaults to `eventlog.application-id` or `spring.application.name`
- When Spring Cloud Config is on the classpath, Event Log beans are refresh-scoped and reloaded on config refresh (see [Refresh Scope](/java-sdk/spring-boot/refresh-scope))
