---
title: Getting Started
---

# Getting Started

This guide covers setting up the Java SDK with both Spring Boot and plain Java.

## Quick Start (Recommended: Real-Time Async Logging)

**Important:** Log events immediately after each step completes, not in batches at the end. This ensures events are captured even if your process crashes mid-way.

```java
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.model.*;
import static com.eventlog.sdk.util.EventLogUtils.*;

// === SETUP (once at application startup) ===

// 1. Configure OAuth authentication
OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
    .tokenUrl("https://auth.yourcompany.com/oauth/token")
    .clientId("your-client-id")
    .clientSecret("your-client-secret")
    .scope("eventlog:write eventlog:read")  // optional
    .build();

// 2. Create client with OAuth
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .tokenProvider(tokenProvider)
    .build();

// 3. Create async logger (fire-and-forget)
AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .queueCapacity(10_000)
    .maxRetries(3)
    .circuitBreakerThreshold(5)
    .spilloverPath(Path.of("/var/log/eventlog-spillover"))
    .build();

// === IN YOUR BUSINESS LOGIC ===

String correlationId = createCorrelationId("auth");
String traceId = createTraceId();

// Step 1: Do work, then log immediately
var result = doIdentityVerification();
eventLog.log(step(correlationId, traceId, "MY_PROCESS", 1, "Identity Check")
    .eventStatus(result.success ? EventStatus.SUCCESS : EventStatus.FAILURE)
    .summary("Identity verified - " + result.message)
    // ... other fields
    .build());
// Returns immediately - never blocks your business logic

// Step 2: Do more work, log immediately
var creditResult = doCreditCheck();
eventLog.log(step(correlationId, traceId, "MY_PROCESS", 2, "Credit Check")
    .eventStatus(creditResult.approved ? EventStatus.SUCCESS : EventStatus.FAILURE)
    .summary("Credit check - FICO " + creditResult.score)
    .build());

// Metrics
System.out.println(eventLog.getMetrics());
// Output: Metrics{queued=2, sent=2, failed=0, spilled=0, depth=0, circuitOpen=false}
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

## Spring Boot Setup

With the Spring Boot starter, setup is much simpler — just add the dependency and configure properties:

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

Then inject and use:

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

## Plain Java Setup

For applications without Spring Boot, use the builder API directly:

```java
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .apiKey("your-api-key")
    .build();

String correlationId = createCorrelationId("auth");
String traceId = createTraceId();

EventLogEntry event = EventLogEntry.builder()
    .correlationId(correlationId)
    .traceId(traceId)
    .applicationId("auth-user-service")
    .targetSystem("EXPERIAN")
    .originatingSystem("MOBILE_APP")
    .processName("ADD_AUTH_USER")
    .eventType(EventType.STEP)
    .eventStatus(EventStatus.SUCCESS)
    .stepSequence(1)
    .stepName("Validate auth user identity")
    .summary("Validated authorized user Jane Doe")
    .result("IDENTITY_VERIFIED")
    .addIdentifier("auth_user_id", "AU-111222")
    .build();

var response = client.createEvent(event);
System.out.println("Created event: " + response.getExecutionIds());
```

## Next Steps

- [AsyncEventLogger](/java-sdk/core/async-event-logger) — fire-and-forget logging with retry and spillover
- [EventLogTemplate](/java-sdk/core/event-log-template) — fluent process logging with MDC support
- [@LogEvent Annotation](/java-sdk/spring-boot/annotations) — automatic method-level logging
- [Configuration Reference](/java-sdk/spring-boot/configuration) — full property table
