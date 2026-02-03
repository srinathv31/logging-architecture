# Event Log SDK for Java

Java SDK for the Event Log API v1.4 - Centralized event logging for Credit Card Technology.

## Requirements

- Java 11 or higher
- No external HTTP client dependencies (uses Java 11+ HttpClient)

## Installation

### Maven

Add to your `pom.xml`:

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-sdk</artifactId>
    <version>1.4.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'com.yourcompany.eventlog:eventlog-sdk:1.4.0'
```

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
// ⬆️ Returns immediately - never blocks your business logic

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
❌ Batch at end (WRONG):           ✅ Log per step (CORRECT):
   Step 1 ✓ (in memory)               Step 1 ✓ → 📤 sent
   Step 2 ✓ (in memory)               Step 2 ✓ → 📤 sent
   Step 3 💥 CRASH                    Step 3 💥 CRASH
   ─────────────────                  ─────────────────
   Events sent: 0                     Events sent: 2
   Events lost: 2                     Events lost: 0
```

## AsyncEventLogger Features

| Feature | Description |
|---------|-------------|
| **Fire-and-forget** | `log()` returns immediately, never blocks |
| **Automatic retry** | Failed events retry with exponential backoff |
| **Circuit breaker** | Stops hammering API when it's down |
| **Graceful shutdown** | Flushes pending events on JVM shutdown |
| **Spillover to disk** | Saves events to file when API unreachable |

```java
AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .queueCapacity(10_000)           // Buffer size
    .maxRetries(3)                    // Retry attempts
    .baseRetryDelayMs(1000)          // Initial retry delay
    .maxRetryDelayMs(30_000)         // Max retry delay
    .circuitBreakerThreshold(5)       // Failures before circuit opens
    .circuitBreakerResetMs(30_000)    // Time before circuit resets
    .spilloverPath(Path.of("/var/log/spillover"))  // Disk backup
    .build();
```

## Synchronous Client (For Special Cases)

Use the synchronous `EventLogClient` only when you need confirmation that events were sent (rare).

```java
// Single event (waits for response)
var response = client.createEvent(event);

// Batch (for bulk imports, migrations)
var batchResponse = client.createEvents(List.of(event1, event2, event3));
```

## Quick Start

```java
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.model.*;
import com.eventlog.sdk.util.EventLogUtils;
import static com.eventlog.sdk.util.EventLogUtils.*;

// Create client
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .apiKey("your-api-key")
    .build();

// Generate IDs
String correlationId = createCorrelationId("auth");
String traceId = createTraceId();

// Create and send an event
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
    .summary("Validated authorized user Jane Doe (SSN ***5678) against Experian - identity confirmed, fraud score 0.08")
    .result("IDENTITY_VERIFIED")
    .addIdentifier("auth_user_id", "AU-111222")
    .addIdentifier("auth_user_ssn_last4", "5678")
    .endpoint("/v2/identity/verify")
    .httpMethod(HttpMethod.POST)
    .httpStatusCode(200)
    .executionTimeMs(920)
    .build();

var response = client.createEvent(event);
System.out.println("Created event: " + response.getExecutionIds());
```

## Using Typed Event Helpers

The SDK provides helper methods for creating properly structured events:

```java
import static com.eventlog.sdk.util.EventLogUtils.*;

String correlationId = createCorrelationId("emp");
String traceId = createTraceId();

// Process Start
EventLogEntry start = processStart(correlationId, traceId, "EMPLOYEE_CARD_ORIGINATION")
    .applicationId("employee-origination-service")
    .targetSystem("EMPLOYEE_ORIGINATION_SERVICE")
    .originatingSystem("HR_PORTAL")
    .summary("Employee card origination initiated for employee EMP-456 via HR portal")
    .result("INITIATED")
    .addIdentifier("employee_id", "EMP-456")
    .build();

// Step event
EventLogEntry step = step(correlationId, traceId, "EMPLOYEE_CARD_ORIGINATION", 1, "HR Validation")
    .applicationId("employee-origination-service")
    .targetSystem("WORKDAY")
    .originatingSystem("EMPLOYEE_ORIGINATION_SERVICE")
    .eventStatus(EventStatus.SUCCESS)
    .summary("Validated employee EMP-456 exists in Workday - active status confirmed")
    .result("EMPLOYEE_VERIFIED")
    .executionTimeMs(245)
    .build();

// Process End
EventLogEntry end = processEnd(correlationId, traceId, "EMPLOYEE_CARD_ORIGINATION", 5, EventStatus.SUCCESS, 3200)
    .applicationId("employee-origination-service")
    .targetSystem("HR_PORTAL")
    .originatingSystem("EMPLOYEE_ORIGINATION_SERVICE")
    .summary("Employee card origination completed for EMP-456 - APPROVED with $10,000 limit")
    .result("COMPLETED_APPROVED")
    .build();

// Send all events
client.createEvents(List.of(start, step, end));
```

## Batch Operations

For batch uploads (e.g., CSV processing):

```java
String batchId = createBatchId("hr-upload");

List<EventLogEntry> events = csvRows.stream()
    .map(row -> {
        String corrId = createCorrelationId("emp");
        return processStart(corrId, createTraceId(), "EMPLOYEE_CARD_ORIGINATION")
            .batchId(batchId)  // Group all rows under same batch
            .applicationId("employee-origination-service")
            .targetSystem("EMPLOYEE_ORIGINATION_SERVICE")
            .originatingSystem("HR_PORTAL")
            .summary("Employee card origination initiated for " + row.getEmployeeId())
            .result("INITIATED")
            .addIdentifier("employee_id", row.getEmployeeId())
            .build();
    })
    .collect(Collectors.toList());

var response = client.createEvents(events);

// Check batch progress later
var summary = client.getBatchSummary(batchId);
System.out.printf("Batch %s: %d completed, %d failed, %d in progress%n",
    batchId, summary.getCompleted(), summary.getFailed(), summary.getInProgress());
```

## Fork-Join Pattern (Parallel Steps)

When steps run in parallel and a subsequent step depends on them:

```java
// Parallel steps (both have step_sequence = 2)
EventLogEntry odsStep = step(corrId, traceId, processName, 2, "Create ODS Entry")
    .spanId("span-003")
    .parentSpanId("span-002")
    // ... other fields
    .build();

EventLogEntry regulatoryStep = step(corrId, traceId, processName, 2, "Initialize Regulatory Controls")
    .spanId("span-004")
    .parentSpanId("span-002")
    // ... other fields
    .build();

// Step that waits for both parallel steps
EventLogEntry dependentStep = step(corrId, traceId, processName, 3, "Background Checks")
    .spanId("span-005")
    .parentSpanId("span-002")
    .spanLinks(List.of("span-003", "span-004"))  // Waited for both
    // ... other fields
    .build();
```

## Correlation Links

Link correlation IDs to accounts after account creation:

```java
// After account is provisioned downstream
client.createCorrelationLink(
    correlationId,           // Process correlation ID
    "AC-EMP-001234",        // New account ID
    "APP-998877",           // Application ID
    "EMP-456",              // Customer/Employee ID
    null                    // Card last 4 (optional)
);
```

## Querying Events

```java
// Get events by account
var accountEvents = client.getEventsByAccount("AC-1234567890");

// With filters
var filteredEvents = client.getEventsByAccount("AC-1234567890", Map.of(
    "start_date", "2025-01-01T00:00:00Z",
    "process_name", "ADD_AUTH_USER",
    "event_status", "FAILURE"
));

// Get events by correlation ID
var processEvents = client.getEventsByCorrelation("corr-emp-20250126-a1b2c3");

// Get events by trace ID (distributed tracing)
var traceEvents = client.getEventsByTrace("4bf92f3577b34da6a3ce929d0e0e4736");
```

## Async Operations

All write operations have async variants:

```java
// Async event creation
CompletableFuture<CreateEventResponse> future = client.createEventAsync(event);

// With callback
future.thenAccept(response -> {
    System.out.println("Event created: " + response.getExecutionIds());
}).exceptionally(ex -> {
    System.err.println("Failed: " + ex.getMessage());
    return null;
});

// Or wait for result
CreateEventResponse response = future.get();
```

## Error Handling

```java
try {
    client.createEvent(event);
} catch (EventLogException e) {
    System.err.println("Status: " + e.getStatusCode());
    System.err.println("Error code: " + e.getErrorCode());
    System.err.println("Message: " + e.getMessage());
}
```

## Configuration Options

```java
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")  // Required
    .apiKey("your-api-key")                           // Optional
    .applicationId("my-service")                      // Sets X-Application-Id header
    .timeout(Duration.ofSeconds(30))                  // Connection timeout
    .maxRetries(3)                                    // Retry attempts on 5xx/429
    .retryDelay(Duration.ofMillis(500))              // Base delay (exponential backoff)
    .build();
```

## Building from Source

```bash
mvn clean package

# Run tests
mvn test

# Install to local Maven repo
mvn install

# Create source and javadoc JARs (for publishing)
mvn package -Prelease
```

## Publishing

### To Internal Artifactory/Nexus

1. Configure repository in `pom.xml`:

```xml
<distributionManagement>
    <repository>
        <id>internal-releases</id>
        <url>https://artifactory.yourcompany.com/artifactory/libs-release</url>
    </repository>
</distributionManagement>
```

2. Configure credentials in `~/.m2/settings.xml`:

```xml
<servers>
    <server>
        <id>internal-releases</id>
        <username>your-username</username>
        <password>your-password</password>
    </server>
</servers>
```

3. Deploy:

```bash
mvn deploy
```

### To Maven Central

See [Sonatype OSSRH Guide](https://central.sonatype.org/publish/publish-guide/) for complete instructions.

## Version Compatibility

| SDK Version | API Version | Java Version |
|-------------|-------------|--------------|
| 1.4.x       | v1.4        | 11+          |
| 1.3.x       | v1.3        | 11+          |

## License

Apache License, Version 2.0
