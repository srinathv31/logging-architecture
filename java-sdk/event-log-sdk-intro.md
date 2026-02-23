# Event Log SDK - Introduction Guide

A Java SDK for centralized event logging, designed for credit card processing and high-reliability applications.

**Target Audience:** Java developers (Spring Boot and non-Spring) and Node.js developers exploring Java integration.

---

## Core Philosophy

This SDK is built around three principles:

1. **Easy to Use** - Sensible defaults, fluent APIs, and minimal boilerplate
2. **Easy to Configure** - YAML-based config for Spring Boot, builder pattern for plain Java
3. **Non-Blocking** - Fire-and-forget logging that never slows down your business logic

---

## What This SDK Does

The Event Log SDK sends structured events to a centralized Event Log API. These events track:

- Process execution (start, steps, end)
- HTTP requests and responses
- Errors and warnings
- Business identifiers for correlation
- Execution timing and performance metrics

Think of it as structured logging for distributed systems, with built-in support for tracing, correlation, and querying.

---

## Quick Start

### Spring Boot (Recommended)

**Step 1: Add the dependency**

```xml
<dependency>
    <groupId>com.eventlog</groupId>
    <artifactId>eventlog-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

**Step 2: Configure in application.yml**

```yaml
eventlog:
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: my-service

  # Choose one authentication method:

  # Option A: API Key (simpler)
  api-key: ${EVENT_LOG_API_KEY}

  # Option B: OAuth (recommended for production)
  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: ${CLIENT_ID}
    client-secret: ${CLIENT_SECRET}
    scope: eventlog:write eventlog:read
```

**Step 3: Set up MDC context (filter or interceptor)**

```java
@Component
public class CorrelationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            // Use your team's prefix for easy identification in logs
            MDC.put("correlationId", EventLogUtils.createCorrelationId("payment"));
            MDC.put("traceId", EventLogUtils.createTraceId());
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
```

**Step 4: Inject and use**

```java
@Service
public class PaymentService {

    private final EventLogTemplate template;

    public PaymentService(EventLogTemplate template) {
        this.template = template;
    }

    public void processPayment(String accountId, BigDecimal amount) {
        // IDs automatically read from MDC - no manual passing required
        EventLogTemplate.ProcessLogger process = template.forProcess("PAYMENT_PROCESS")
            .addIdentifier("accountId", accountId)
            .addMetadata("amount", amount);

        // Ensure MDC is populated per request; otherwise set correlation/trace IDs explicitly.
        process.processStart("Processing payment of $" + amount, "STARTED");

        try {
            // Step 1 - has accountId, amount
            process.logStep(1, "Validate Card", EventStatus.SUCCESS, "Card validated");
            validateCard();

            // Add data as you learn it - applies to subsequent events
            String authId = chargeCard(amount);
            process.addIdentifier("authId", authId);

            // Step 2 - has accountId, amount, authId
            process.logStep(2, "Charge Card", EventStatus.SUCCESS, "Card charged");

            process.processEnd(3, EventStatus.SUCCESS, "Payment completed");

        } catch (Exception e) {
            process.error(e.getClass().getSimpleName(), e.getMessage());
            throw e;
        }
    }
}
```

**Why EventLogTemplate?**
- Auto-configured with `applicationId`, `targetSystem`, `originatingSystem` from YAML
- Reads `correlationId`, `traceId`, `spanId` from MDC automatically
- Identifiers/metadata stack forward as you learn new data
- Convenience methods with sensible defaults (`result` defaults to status name)

### Annotation-Based (Zero Boilerplate)

```java
@Service
public class PaymentService {

    @LogEvent(process = "PAYMENT_PROCESS", step = 1, name = "Validate Card")
    public void validateCard(String cardNumber) {
        // Method execution automatically logged with timing
    }

    // Process name can be omitted - defaults to class name ("PaymentService")
    @LogEvent(process = "", step = 2, name = "Process Payment")
    public PaymentResult processPayment(PaymentRequest request) {
        // Success/failure automatically captured
        return result;
    }
}
```

The `@LogEvent` annotation:
- Automatically captures method execution time
- Logs success/failure based on method outcome
- Reads correlation context from SLF4J MDC
- Never blocks your business logic
- **Defaults `process` to class name when blank** (with a warning log for visibility)

### Plain Java (Non-Spring)

```java
// 1. Create token provider (OAuth)
OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
    .tokenUrl("https://auth.example.com/oauth/token")
    .clientId("client-id")
    .clientSecret("client-secret")
    .build();

// 2. Create client
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.example.com")
    .tokenProvider(tokenProvider)
    .build();

// 3. Create async logger (recommended)
AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .queueCapacity(10_000)
    .build();

// 4. Log events (fire-and-forget)
eventLog.log(EventLogUtils.step(
        correlationId,
        traceId,
        "MY_PROCESS",
        1,
        "Step Name",
        EventStatus.SUCCESS,
        "my-service",
        "MY_SYSTEM",
        "MY_SYSTEM",
        "Step completed",
        "SUCCESS")
    .build());

// 5. On application shutdown
eventLog.shutdown();  // Flushes pending events
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Your Application                            │
│                                                                  │
│  eventLog.log(event)  ──────►  Returns immediately (non-blocking)│
└───────────────────────────────────┬──────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AsyncEventLogger                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  In-Memory  │───►│  Background │───►│  HTTP Transport     │  │
│  │   Queue     │    │   Sender    │    │  (WebClient/JDK)    │  │
│  │  (10k cap)  │    │   Thread    │    └─────────┬───────────┘  │
│  └──────┬──────┘    └──────┬──────┘              │              │
│         │                  │                     ▼              │
│         │           ┌──────┴──────┐    ┌─────────────────────┐  │
│         │           │   Retry     │    │  Circuit Breaker    │  │
│         │           │  Scheduler  │    │  (stops after 5     │  │
│         │           │  (exp.      │    │   consecutive       │  │
│         │           │   backoff)  │    │   failures)         │  │
│         │           └─────────────┘    └─────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Spillover to Disk (when queue full or API unavailable)     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │   Event Log API     │
                        └─────────────────────┘
```

**Key Design Decisions:**

| Feature | Why |
|---------|-----|
| Fire-and-forget | Logging should never slow down business logic |
| In-memory queue | Decouples application from network latency |
| Circuit breaker | Stops hammering a failing API |
| Spillover to disk | No event loss even when API is down |
| Graceful shutdown | Flushes pending events before exit |

---

## Event Structure

Every event contains:

```java
EventLogEntry.builder()
    // Identifiers (for tracing and correlation)
    .correlationId("payment-20240115-abc123")    // Links related events
    .accountId("ACC-12345")                       // Business account
    .traceId("4bf92f3577b34da6a3ce929d0e0e4736") // W3C trace format
    .spanId("00f067aa0ba902b7")                   // Current operation
    .parentSpanId("...")                          // Parent operation
    .batchId("batch-20240115-import-xyz")        // Batch processing ID

    // System context
    .applicationId("payment-service")
    .targetSystem("card-processor")
    .originatingSystem("checkout-service")

    // Process details
    .processName("PAYMENT_PROCESS")
    .stepSequence(1)
    .stepName("Validate Card")
    .eventType(EventType.STEP)           // PROCESS_START, PROCESS_END, STEP, ERROR, WARNING
    .eventStatus(EventStatus.SUCCESS)    // SUCCESS, FAILURE, IN_PROGRESS, PENDING, TIMEOUT

    // Business data
    .summary("Card validation completed")
    .result("APPROVED")
    .identifiers(Map.of("orderId", "ORD-789", "cardLast4", "4242"))
    .metadata(Map.of("processor", "stripe", "region", "us-west-2"))

    // Timing
    .eventTimestamp(Instant.now())
    .executionTimeMs(150L)

    // HTTP details (if applicable)
    .endpoint("/api/v1/payments")
    .httpMethod(HttpMethod.POST)
    .httpStatusCode(200)

    // Error tracking (if applicable)
    .errorCode("CARD_DECLINED")
    .errorMessage("Insufficient funds")

    // Payloads (sanitized, no PII)
    .requestPayload("{...}")
    .responsePayload("{...}")

    .build();
```

---

## Utility Methods

The `EventLogUtils` class provides helpers for common patterns:

```java
// ID Generation
String correlationId = EventLogUtils.createCorrelationId("payment");
// Result: "payment-20240115143052-a1b2c3"

String traceId = EventLogUtils.createTraceId();
// Result: "4bf92f3577b34da6a3ce929d0e0e4736" (32 hex chars, W3C format)

String spanId = EventLogUtils.createSpanId();
// Result: "00f067aa0ba902b7" (16 hex chars)

String batchId = EventLogUtils.createBatchId("import");
// Result: "batch-20240115-import-x7y8z9"

// Pre-typed event builders (basic - requires additional fields before build())
EventLogEntry.Builder start = EventLogUtils.processStart(correlationId, traceId, "MY_PROCESS");
EventLogEntry.Builder step = EventLogUtils.step(correlationId, traceId, "MY_PROCESS", 1, "Step Name");
EventLogEntry.Builder end = EventLogUtils.processEnd(correlationId, traceId, "MY_PROCESS");

// Complete overloads (all required fields included - ready to build())
EventLogEntry.Builder start = EventLogUtils.processStart(
    correlationId, traceId, "MY_PROCESS",
    "my-app", "target-sys", "origin-sys",  // applicationId, targetSystem, originatingSystem
    "Starting process", "STARTED");         // summary, result

EventLogEntry.Builder step = EventLogUtils.step(
    correlationId, traceId, "MY_PROCESS", 1, "Validate",
    EventStatus.SUCCESS,
    "my-app", "target-sys", "origin-sys",
    "Validation complete", "VALID");

EventLogEntry.Builder end = EventLogUtils.processEnd(
    correlationId, traceId, "MY_PROCESS", 3, EventStatus.SUCCESS, 1500,
    "my-app", "target-sys", "origin-sys",
    "Process complete", "SUCCESS");

EventLogEntry.Builder err = EventLogUtils.error(
    correlationId, traceId, "MY_PROCESS", "ERR_001", "Something failed",
    "my-app", "target-sys", "origin-sys",
    "Operation failed", "FAILED");
```

---

## Configuration Reference

### Full Spring Boot Configuration

```yaml
eventlog:
  # Required
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: my-service

  # Authentication (choose one)
  api-key: ${EVENT_LOG_API_KEY}         # Simple API key

  oauth:                                 # Or OAuth 2.0
    token-url: https://auth.example.com/oauth/token
    client-id: ${CLIENT_ID}
    client-secret: ${CLIENT_SECRET}
    scope: eventlog:write eventlog:read
    refresh-buffer: 60s                  # Refresh token this far before expiry
    connect-timeout: 10s
    request-timeout: 30s

  # HTTP settings
  connect-timeout: 10s                   # Connection timeout
  request-timeout: 30s                   # Request timeout
  max-retries: 3                         # Max retry attempts
  retry-delay: 500ms                     # Initial retry delay

  # Transport selection (auto-detected if omitted)
  transport: webclient                   # webclient, restclient, or jdk

  # Async logger settings
  async:
    enabled: true
    queue-capacity: 10000                # In-memory queue size
    max-retries: 3                       # Max retries per event
    base-retry-delay-ms: 1000            # Initial retry delay
    max-retry-delay-ms: 30000            # Max retry delay (30s)
    circuit-breaker-threshold: 5         # Failures before circuit opens
    circuit-breaker-reset-ms: 30000      # Time before retrying (30s)
    spillover-path: /var/log/eventlog    # Disk spillover location
    virtual-threads: false               # Use virtual threads (Java 21+)
    executor: virtual                    # virtual, spring, or bean name

  # Annotation support
  annotation:
    enabled: true                        # Enable @LogEvent aspect

  # System identification
  target-system: external-api            # Default: application-id
  originating-system: upstream-service   # Default: application-id

  # Spring Cloud Config integration
  refresh:
    enabled: true                        # Reconfigure on @RefreshScope
```

### Profile-Aware Defaults

The SDK automatically adjusts timeouts based on Spring profiles:

| Profile | Connect Timeout | Request Timeout |
|---------|-----------------|-----------------|
| `dev`, `local`, `test` | 5s | 10s |
| Production (default) | 10s | 30s |

---

## Testing

### Using MockAsyncEventLogger

Add the test dependency:

```xml
<dependency>
    <groupId>com.eventlog</groupId>
    <artifactId>eventlog-test</artifactId>
    <version>1.0.0</version>
    <scope>test</scope>
</dependency>
```

Write tests:

```java
@SpringBootTest
@ActiveProfiles("test")
class PaymentServiceTest {

    @Autowired
    private MockAsyncEventLogger eventLog;

    @Autowired
    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        eventLog.reset();  // Clear captured events
    }

    @Test
    void shouldLogPaymentEvents() {
        // Given
        String accountId = "ACC-123";

        // When
        paymentService.processPayment(accountId, new BigDecimal("100.00"));

        // Then
        eventLog.assertEventCount(2);  // Start + End
        eventLog.assertEventLogged("PAYMENT_PROCESS", EventType.PROCESS_START);
        eventLog.assertEventLogged("PAYMENT_PROCESS", EventType.PROCESS_END);

        // Access captured events for detailed assertions
        List<EventLogEntry> events = eventLog.getCapturedEvents();
        assertThat(events.get(0).getAccountId()).isEqualTo(accountId);
    }

    @Test
    void shouldLogErrorOnFailure() {
        // When
        assertThrows(PaymentException.class, () ->
            paymentService.processPayment("BAD-ACCOUNT", new BigDecimal("100.00")));

        // Then
        List<EventLogEntry> events = eventLog.getEventsForProcess("PAYMENT_PROCESS");
        EventLogEntry errorEvent = events.stream()
            .filter(e -> e.getEventStatus() == EventStatus.FAILURE)
            .findFirst()
            .orElseThrow();

        assertThat(errorEvent.getErrorCode()).isEqualTo("INVALID_ACCOUNT");
    }
}
```

### Manual Mock (Non-Spring)

```java
MockAsyncEventLogger eventLog = new MockAsyncEventLogger();

// Use in tests
myService.setEventLog(eventLog);
myService.doSomething();

eventLog.assertEventCount(1);
```

---

## Common Patterns

### Pattern 1: Process with Multiple Steps

```java
public void processOrder(Order order) {
    // Use EventLogTemplate for multi-step processes
    EventLogTemplate.ProcessLogger process = template.forProcess("ORDER_PROCESS")
        .addIdentifier("accountId", order.getAccountId())
        .addIdentifier("orderId", order.getId());

    process.processStart("Processing order " + order.getId(), "STARTED");

    try {
        process.logStep(1, "Validate Order", EventStatus.IN_PROGRESS, "Validating");
        validateOrder(order);

        process.logStep(2, "Process Payment", EventStatus.IN_PROGRESS, "Processing");
        processPayment(order);

        process.processEnd(3, EventStatus.SUCCESS, "Order completed successfully");

    } catch (Exception e) {
        process.error(e.getClass().getSimpleName(), e.getMessage());
        throw e;
    }
}
```

### Pattern 2: MDC Context Propagation

```java
// Set context at request entry point (e.g., filter or interceptor)
MDC.put("correlationId", EventLogUtils.createCorrelationId("api"));
MDC.put("traceId", EventLogUtils.createTraceId());
MDC.put("spanId", EventLogUtils.createSpanId());

try {
    // @LogEvent annotations automatically read from MDC
    myService.doSomething();
} finally {
    MDC.clear();
}
```

### Pattern 3: Parallel Operations (Span Links)

```java
String correlationId = EventLogUtils.createCorrelationId("parallel");
String traceId = EventLogUtils.createTraceId();
String parentSpanId = EventLogUtils.createSpanId();

// Run operations in parallel, each with its own span
List<String> childSpanIds = List.of(
    EventLogUtils.createSpanId(),
    EventLogUtils.createSpanId(),
    EventLogUtils.createSpanId()
);

// Log parent with links to children
eventLog.log(EventLogEntry.builder()
    .correlationId(correlationId)
    .traceId(traceId)
    .spanId(parentSpanId)
    .spanLinks(childSpanIds)  // Links to parallel children
    .applicationId("my-service")
    .targetSystem("MY_SYSTEM")
    .originatingSystem("MY_SYSTEM")
    .processName("PARALLEL_PROCESS")
    .eventType(EventType.STEP)
    .eventStatus(EventStatus.IN_PROGRESS)
    .stepSequence(1)
    .stepName("Fork parallel operations")
    .summary("Forking 3 parallel tasks")
    .result("FORKED")
    .build());

// Execute and log each child operation
CompletableFuture.allOf(
    // Each parallel task logs with its own spanId and parentSpanId
).join();
```

### Pattern 4: HTTP Request/Response Logging

```java
eventLog.log(EventLogEntry.builder()
    .correlationId(correlationId)
    .traceId(traceId)
    .applicationId("my-service")
    .targetSystem("EXTERNAL_API")
    .originatingSystem("my-service")
    .processName("API_CALL")
    .eventType(EventType.STEP)
    .eventStatus(EventStatus.SUCCESS)
    .stepSequence(1)
    .stepName("Call External API")
    .summary("POST to external API succeeded")
    .result("HTTP_200")
    .endpoint("https://api.example.com/v1/resource")
    .httpMethod(HttpMethod.POST)
    .httpStatusCode(200)
    .executionTimeMs(response.getElapsedTime())
    .requestPayload(sanitize(request))   // Remove PII!
    .responsePayload(sanitize(response)) // Remove PII!
    .build());
```

### Pattern 5: EventLogTemplate for Multi-Step Processes

Using `EventLogTemplate` provides the cleanest API for process logging:

```java
@Service
public class OrderService {

    private final EventLogTemplate template;

    public OrderService(EventLogTemplate template) {
        this.template = template;
    }

    public void processOrder(Order order) {
        EventLogTemplate.ProcessLogger process = template.forProcess("ORDER_PROCESS")
            .addIdentifier("accountId", order.getAccountId())
            .addIdentifier("orderId", order.getId());

        process.processStart("Processing order " + order.getId(), "STARTED");

        try {
            process.logStep(1, "Validate Order", EventStatus.SUCCESS, "Order validated");
            validateOrder(order);

            // Add reservation ID when we get it
            String reservationId = reserveInventory(order);
            process.addIdentifier("reservationId", reservationId);

            process.logStep(2, "Reserve Inventory", EventStatus.SUCCESS, "Items reserved");

            // Add payment transaction ID when we get it
            String txnId = processPayment(order);
            process.addIdentifier("transactionId", txnId);

            process.logStep(3, "Process Payment", EventStatus.SUCCESS, "Payment processed");

            process.processEnd(4, EventStatus.SUCCESS, "Order completed");

        } catch (Exception e) {
            process.error(e.getClass().getSimpleName(), e.getMessage());
            throw e;
        }
    }
}
```

---

## For Node.js Developers

If you're coming from Node.js, here's a conceptual mapping:

| Node.js Concept | Java SDK Equivalent |
|-----------------|---------------------|
| `npm install` | Maven dependency in `pom.xml` |
| `require()` / `import` | Spring `@Autowired` or `new Builder()` |
| `async/await` | `AsyncEventLogger.log()` (fire-and-forget) |
| `.env` file | `application.yml` or environment variables |
| Middleware | `@LogEvent` annotation or Spring interceptors |
| `console.log()` | `eventLog.log(EventLogEntry.builder()...)` |
| Jest mocks | `MockAsyncEventLogger` |

The SDK handles:
- Connection pooling (like `http.Agent` keepAlive)
- Retry with backoff (like `axios-retry`)
- Circuit breaking (like `opossum`)
- Graceful shutdown (like `process.on('SIGTERM')`)

---

## Troubleshooting

### Events Not Being Sent

1. Check `eventlog.enabled: true` in config
2. Verify `base-url` is correct and reachable
3. Check authentication (API key or OAuth credentials)
4. Look for errors in application logs

### OAuth Token Errors

1. Verify token URL, client ID, and secret
2. Check scopes are correct
3. Ensure network can reach auth server
4. Look for clock skew issues

### Circuit Breaker Open

The circuit breaker opens after 5 consecutive failures. Check:
1. Event Log API health
2. Network connectivity
3. Authentication credentials

Events will spill to disk and retry when circuit resets (30s default).

### Missing Events in Tests

1. Ensure `@ActiveProfiles("test")` is set
2. Autowire `MockAsyncEventLogger`, not `AsyncEventLogger`
3. Call `eventLog.reset()` in `@BeforeEach`

---

## Requirements

- **Java 21+** (required)
- **Spring Boot 3.2+** (for starter module)
- **Maven** (for dependency management)

---

## Module Summary

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `eventlog-sdk` | Core SDK, no Spring required | Plain Java applications |
| `eventlog-spring-boot-starter` | Auto-configuration, `@LogEvent` | Spring Boot applications |
| `eventlog-test` | Mock logger for testing | Unit and integration tests |
| `eventlog-sdk-bom` | Version management | Multi-module projects |

---

## Further Reading

- [README.md](./README.md) - Full API reference
- [MIGRATION.md](./MIGRATION.md) - Migrating from manual to starter
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [docs/architecture.md](./docs/architecture.md) - Detailed architecture diagrams
- [docs/examples.md](./docs/examples.md) - Additional code examples
