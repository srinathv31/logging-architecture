---
title: Getting Started
---

# Getting Started

## Spring Boot Quick Start

Add the starter dependency:

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

Configure `application.yml`:

```yaml
eventlog:
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: my-service

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

Inject and use:

```java
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

See [Auto-Configuration](/java-sdk/spring-boot/auto-configuration) for full Spring Boot setup details.

## Two Ways to Log Events

The SDK provides two APIs for logging events. Choose the one that fits your use case:

| | **EventLogTemplate** | **@LogEvent Annotation** |
|---|---|---|
| **Best for** | Multi-step processes with per-step control | Simple method-level logging |
| **How it works** | Inject template, call `logStep()` per step | Annotate methods, logging happens automatically |
| **Control level** | Full — payloads, timing, identifiers per step | Convention-based — status derived from method outcome |

```java
// EventLogTemplate — explicit, step-by-step control
ProcessLogger process = template.forProcess("ORDER_PROCESSING")
    .addIdentifier("orderId", order.getId());
process.logStep(1, "Validate", EventStatus.SUCCESS, "Order validated");
process.logStep(2, "Reserve", EventStatus.SUCCESS, "Inventory reserved");
```

```java
// @LogEvent — automatic, annotation-driven
@LogEvent(processName = "USER_LOOKUP", stepName = "Find User")
public User findUser(String userId) {
    return userRepository.findById(userId);
}
```

See [EventLogTemplate](/java-sdk/core/event-log-template) and [@LogEvent Annotation](/java-sdk/spring-boot/annotations) for full details.

## EventLogTemplate Example

**Important:** Log events immediately after each step completes, not in batches at the end. This ensures events are captured even if your process crashes mid-way.

```java
@Service
public class AuthUserService {
    private final EventLogTemplate template;

    public AuthUserService(EventLogTemplate template) {
        this.template = template;
    }

    public void onboardUser(String userId) {
        // IDs read from MDC automatically in Spring Boot
        ProcessLogger process = template.forProcess("ADD_AUTH_USER")
            .addIdentifier("auth_user_id", userId);

        // Process start
        process.processStart("Auth user onboarding initiated", "INITIATED");

        // Step 1: Do work, then log immediately
        var result = doIdentityVerification();
        process.withExecutionTimeMs(result.durationMs)
            .withRequestPayload(result.request)
            .withResponsePayload(result.response)
            .logStep(1, "Identity Check",
                result.success ? EventStatus.SUCCESS : EventStatus.FAILURE,
                "Identity verified - " + result.message, "IDENTITY_VERIFIED");
        // Returns immediately - never blocks your business logic
        // One-shot fields (executionTimeMs, payloads) auto-clear after each emit

        // Step 2: Do more work, log immediately
        var creditResult = doCreditCheck();
        process.withExecutionTimeMs(creditResult.durationMs)
            .logStep(2, "Credit Check",
                creditResult.approved ? EventStatus.SUCCESS : EventStatus.FAILURE,
                "Credit check - FICO " + creditResult.score, "CREDIT_CHECKED");

        // Process end with total duration
        process.processEnd(3, EventStatus.SUCCESS, "Auth user added", "COMPLETED", 3200);
    }
}
```

### Why Real-Time Logging?

```
Bad - Batch at end:                Good - Log per step:
   Step 1 completed (in memory)      Step 1 completed -> sent
   Step 2 completed (in memory)      Step 2 completed -> sent
   Step 3 CRASH                      Step 3 CRASH
   ─────────────────                 ─────────────────
   Events sent: 0                    Events sent: 2
   Events lost: 2                    Events lost: 0
```

## Plain Java Setup

For applications without Spring Boot, build `EventLogTemplate` with the client directly:

```java
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .apiKey("your-api-key")
    .build();

AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .build();

EventLogTemplate template = EventLogTemplate.builder(eventLog)
    .applicationId("auth-user-service")
    .targetSystem("EXPERIAN")
    .originatingSystem("MOBILE_APP")
    .build();

ProcessLogger process = template.forProcess("ADD_AUTH_USER")
    .withCorrelationId(EventLogUtils.createCorrelationId("auth"))
    .withTraceId(EventLogUtils.createTraceId())
    .addIdentifier("auth_user_id", "AU-111222");

process.processStart("Auth user onboarding initiated", "INITIATED");

process.logStep(1, "Validate Identity", EventStatus.SUCCESS,
    "Validated authorized user Jane Doe", "IDENTITY_VERIFIED");

process.processEnd(2, EventStatus.SUCCESS,
    "Auth user added successfully", "COMPLETED", 1500);
```

## Next Steps

- [EventLogTemplate](/java-sdk/core/event-log-template) — fluent process logging with MDC support
- [@LogEvent Annotation](/java-sdk/spring-boot/annotations) — automatic method-level logging
- [Configuration Reference](/java-sdk/spring-boot/configuration) — full property table
