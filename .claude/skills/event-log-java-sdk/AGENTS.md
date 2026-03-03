# Event Log Java SDK Patterns - Complete Guide

> This document is mainly for agents and LLMs. For the overview and quick reference, see `SKILL.md`.

## Abstract

Comprehensive guide for integrating the Event Log Java SDK into Spring Boot applications. This document covers all 16 rules across 7 categories: EventLogTemplate usage (ProcessLogger, one-shot fields, error handling, MDC integration), @LogEvent annotation patterns, Spring Boot configuration (YAML, auto-configuration, transport selection), OAuth authentication, advanced patterns (fork-join parallelism, batch operations), resilience (disk spillover, circuit breaker), and testing/troubleshooting. Each section includes impact level, incorrect and correct code examples, and additional context to prevent common integration mistakes.

## Table of Contents

1. [ProcessLogger Pattern](#1-processlogger-pattern)
2. [One-Shot vs Persistent Fields](#2-one-shot-vs-persistent-fields)
3. [Three-Layer Error Handling](#3-three-layer-error-handling)
4. [MDC Integration](#4-mdc-integration)
5. [@LogEvent Annotation](#5-logevent-annotation)
6. [Annotation Configuration](#6-annotation-configuration)
7. [Spring Boot YAML Config](#7-spring-boot-yaml-config)
8. [Auto-Configuration](#8-auto-configuration)
9. [Transport Selection](#9-transport-selection)
10. [OAuth Setup](#10-oauth-setup)
11. [Fork-Join Span Links](#11-fork-join-span-links)
12. [Batch Operations](#12-batch-operations)
13. [Spillover](#13-spillover)
14. [Circuit Breaker](#14-circuit-breaker)
15. [Mock Logger for Tests](#15-mock-logger-for-tests)
16. [Troubleshooting Common Issues](#16-troubleshooting-common-issues)

---

## 1. ProcessLogger Pattern

**Impact: CRITICAL** - core API for logging multi-step processes -- getting this wrong means missing or malformed events

Inject EventLogTemplate, call forProcess("PROCESS_NAME"), add identifiers, then processStart followed by logStep per step followed by processEnd. Log immediately after each step (not batched at end).

**Incorrect (collecting events in a list and sending at end -- crashes lose all events, creating raw EventLogEntry objects manually):**

```java
@Service
public class OrderService {
    private final EventLogTemplate template;

    public void processOrder(Order order) {
        List<EventLogEntry> events = new ArrayList<>();

        events.add(new EventLogEntry("ORDER_PROCESSING", "Start", ...));
        validateOrder(order);
        events.add(new EventLogEntry("ORDER_PROCESSING", "Validate", ...));
        reserveInventory(order);
        events.add(new EventLogEntry("ORDER_PROCESSING", "Reserve", ...));

        // If crash happens here, ALL events are lost
        template.sendAll(events);
    }
}
```

**Correct (log immediately after each step using ProcessLogger):**

```java
@Service
public class OrderService {
    private final EventLogTemplate template;

    public OrderService(EventLogTemplate template) {
        this.template = template;
    }

    public void processOrder(Order order) {
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .addIdentifier("orderId", order.getId());

        process.processStart("Processing order " + order.getId(), "INITIATED");

        var validationResult = validateOrder(order);
        process.logStep(1, "Validate Order", EventStatus.SUCCESS, "Order validated", "VALIDATED");

        var reservation = reserveInventory(order);
        process.addIdentifier("reservationId", reservation.getId());
        process.logStep(2, "Reserve Inventory", EventStatus.SUCCESS, "Inventory reserved", "RESERVED");

        process.processEnd(3, EventStatus.SUCCESS, "Order complete", "COMPLETED", totalMs);
    }
}
```

- ProcessLogger is mutable and request-scoped -- do NOT share across threads.
- Identifiers added via addIdentifier() stack forward to all subsequent events.
- correlationId/traceId are read from MDC automatically in Spring Boot.

---

## 2. One-Shot vs Persistent Fields

**Impact: HIGH** - misunderstanding one-shot vs persistent fields causes data leaking between steps

Persistent fields (withCorrelationId, addIdentifier, addMetadata) apply to ALL subsequent events. One-shot fields (withEndpoint, withHttpMethod, withExecutionTimeMs, withRequestPayload, etc.) apply to the NEXT emit only, then auto-clear.

**Incorrect (setting endpoint/httpMethod and expecting them on all subsequent events):**

```java
process.withEndpoint("/api/v2/partners/verify")
    .withHttpMethod(HttpMethod.POST);

process.logStep(1, "Partner Verify", EventStatus.SUCCESS, "Verified", "OK");
// endpoint and httpMethod are present here

process.logStep(2, "Transform Data", EventStatus.SUCCESS, "Transformed", "OK");
// BUG: endpoint and httpMethod are null here -- they were one-shot fields!
```

**Correct (set one-shot fields before each step that needs them):**

```java
// One-shot fields: set before each step that needs them
process.withEndpoint("/api/v2/partners/verify")
    .withHttpMethod(HttpMethod.POST)
    .withHttpStatusCode(response.statusCode())
    .withRequestPayload(requestBody)
    .withResponsePayload(response.body())
    .withExecutionTimeMs((int) duration.toMillis())
    .logStep(1, "Partner Verify", EventStatus.SUCCESS, "Verified", "OK");

// Next step -- all one-shot fields are automatically cleared
process.logStep(2, "Transform Data", EventStatus.SUCCESS, "Transformed", "OK");
// endpoint, httpMethod, httpStatusCode, payloads, executionTimeMs are all null here
```

### Persistent fields (apply to all subsequent events):

| Method |
|--------|
| `withCorrelationId` |
| `withTraceId` |
| `withSpanId` |
| `withBatchId` |
| `withAccountId` |
| `addIdentifier` |
| `addMetadata` |

### One-shot fields (apply to the next emit only, then auto-clear):

| Method |
|--------|
| `withTargetSystem` |
| `withEndpoint` |
| `withHttpMethod` |
| `withHttpStatusCode` |
| `withSpanLinks` |
| `withRequestPayload` |
| `withResponsePayload` |
| `withExecutionTimeMs` |
| `withIdempotencyKey` |
| `withErrorCode` |
| `withErrorMessage` |

---

## 3. Three-Layer Error Handling

**Impact: CRITICAL** - incorrect error handling means lost diagnostic context for AI agents and operators

Three-layer error handling -- each produces a different event type:
- Layer 1: withErrorCode().withErrorMessage().logStep(FAILURE) produces a STEP event with step context
- Layer 2: processEnd(FAILURE) produces a PROCESS_END event to formally close the process
- Layer 3: error() produces an ERROR event for unhandled exceptions (step_sequence = null)

**Incorrect (only using error() for all failures -- loses step context, not closing process on failure):**

```java
try {
    process.processStart("Processing", "INITIATED");
    reserveInventory(order);
    process.logStep(1, "Reserve Inventory", EventStatus.SUCCESS, "Reserved", "OK");
} catch (Exception e) {
    // BAD: All failures go to error() -- no step context, process never closed
    process.error("ERROR", e.getMessage(), "Failed", "FAILED");
}
```

**Correct (three layers of error handling for full diagnostic context):**

```java
ProcessLogger process = template.forProcess("ORDER_PROCESSING")
    .addIdentifier("order_id", orderId);

try {
    process.processStart("Processing order " + orderId, "INITIATED");

    try {
        reserveInventory(order);
        process.logStep(1, "Reserve Inventory", EventStatus.SUCCESS, "Reserved", "OK");
    } catch (OutOfStockException e) {
        // Layer 1: Known error -> STEP event (step context preserved)
        process.withErrorCode("OUT_OF_STOCK")
            .withErrorMessage(e.getMessage())
            .logStep(1, "Reserve Inventory", EventStatus.FAILURE, "Out of stock", "FAILED");

        // Layer 2: Close the process -> PROCESS_END event
        process.processEnd(2, EventStatus.FAILURE, "Order failed", "FAILED", null);
        throw e;
    }

    process.processEnd(2, EventStatus.SUCCESS, "Order complete", "COMPLETED", totalMs);

} catch (Exception e) {
    // Layer 3: Unhandled exception -> ERROR event (step_sequence = null)
    process.error("UNHANDLED_ERROR", e.getMessage(), "Unexpected error", "FAILED");
    throw e;
}
```

| Layer | Method | Event Type | Step Context | Use For |
|-------|--------|-----------|-------------|---------|
| 1 | withErrorCode().logStep(FAILURE) | STEP | Preserved | Known business errors |
| 2 | processEnd(FAILURE) | PROCESS_END | Step sequence only | Formally closing process |
| 3 | error() | ERROR | Always null | Unhandled exceptions only |

---

## 4. MDC Integration

**Impact: HIGH** - missing MDC setup means events lack correlation/trace IDs

Set correlationId and traceId in MDC at request entry (servlet filter/interceptor). EventLogTemplate reads from MDC automatically -- no manual wiring needed.

**Incorrect (manually passing correlationId to every forProcess() call, forgetting to set MDC):**

```java
@Service
public class OrderService {
    private final EventLogTemplate template;

    public void processOrder(Order order, String correlationId, String traceId) {
        // BAD: manually threading IDs through every method call
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .withCorrelationId(correlationId)
            .withTraceId(traceId);
        // ...
    }
}
```

**Correct (set MDC once at request entry, EventLogTemplate reads automatically):**

```java
// In your filter/interceptor -- set once at request entry
MDC.put("correlationId", EventLogUtils.createCorrelationId("orders"));
MDC.put("traceId", EventLogUtils.createTraceId());
```

```yaml
# Spring Boot auto-config: enable MDC filter
# application.yml:
eventlog:
  mdc-filter:
    url-patterns: "/api/*"
```

```java
// No manual correlation ID wiring needed -- MDC values are picked up automatically
@Service
public class OrderService {
    private final EventLogTemplate template;

    public void processOrder(Order order) {
        ProcessLogger process = template.forProcess("ORDER_PROCESSING")
            .addIdentifier("orderId", order.getId());
        // correlationId and traceId are read from MDC automatically
        process.processStart("Processing order", "INITIATED");
    }
}
```

Supported MDC keys: `correlationId`, `traceId`, `spanId`, `parentSpanId`, `batchId` (also supports snake_case and kebab-case variants such as `correlation_id`, `correlation-id`, etc.).

- The MDC filter registers a servlet filter that populates MDC for matching URL patterns.
- Multiple URL patterns: `url-patterns: "/api/*,/webhook/*"`

---

## 5. @LogEvent Annotation

**Impact: HIGH** - reduces boilerplate for simple method-level logging

Annotate methods with @LogEvent to automatically log execution as STEP events. AOP intercepts, records timing, logs success/failure based on outcome.

**Incorrect (using @LogEvent for multi-step processes -- use EventLogTemplate instead):**

```java
@Service
public class OrderService {

    // BAD: Multi-step process should use EventLogTemplate + ProcessLogger
    @LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Full Order Flow")
    public void processOrder(Order order) {
        validateOrder(order);
        reserveInventory(order);
        chargeCard(order);
        sendConfirmation(order);
        // All steps collapsed into one event -- no step-level visibility
    }
}
```

**Correct (use @LogEvent for simple, single-purpose methods):**

```java
@Service
public class OrderService {

    @LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Validate Order")
    public void validateOrder(Order order) {
        // method execution logged as a STEP event automatically
    }

    @LogEvent(process = "ORDER_PROCESSING", step = 2, name = "Charge Card",
            successStatus = EventStatus.SUCCESS, failureStatus = EventStatus.FAILURE)
    public void chargeCard(Order order) {
        // on success: STEP with SUCCESS status
        // on exception: STEP with FAILURE status
    }
}
```

Requirements:
- Spring Boot starter dependency (AOP enabled automatically)
- `eventlog.application-id` or `spring.application.name` must be set
- Uses MDC values for correlation/trace IDs when present
- `targetSystem` and `originatingSystem` default to `applicationId`

### When to use @LogEvent vs EventLogTemplate

| | EventLogTemplate | @LogEvent |
|---|---|---|
| Best for | Multi-step processes | Simple method-level logging |
| Control | Full -- payloads, timing, identifiers per step | Convention-based |
| How | Inject template, call logStep() | Annotate methods |

---

## 6. Annotation Configuration

**Impact: MEDIUM** - misconfigured annotation attributes lead to incorrect event data

@LogEvent attributes and how to enable/disable the annotation-based logging.

**Incorrect (assuming annotations work without the starter, not setting application-id):**

```java
// BAD: No Spring Boot starter dependency -- @LogEvent silently does nothing
// BAD: No application-id configured -- events have null applicationId
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

---

## 7. Spring Boot YAML Config

**Impact: CRITICAL** - incorrect YAML config prevents the SDK from functioning

The Event Log SDK requires correct YAML configuration under the `eventlog` prefix. A minimal config is sufficient for local development, but production environments need the full set of properties including OAuth, async processing, and spillover.

**Incorrect (missing base-url when enabled):**

```yaml
eventlog:
  enabled: true
  # No base-url -- causes startup failure
```

**Correct (minimal for local development):**

```yaml
eventlog:
  enabled: true
  base-url: http://localhost:3000
  api-key: dev-key
```

**Correct (full production config):**

```yaml
eventlog:
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: my-service
  target-system: MY_SERVICE
  originating-system: MY_SERVICE

  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read

  async:
    enabled: true
    queue-capacity: 10000
    virtual-threads: true
    spillover-path: ./spillover
    replay-interval-ms: 10000

  annotation:
    enabled: true

  mdc-filter:
    url-patterns: "/api/*"
```

When `enabled=true`, the `base-url` property is mandatory. The SDK validates this on startup and fails fast if it is missing. Profile-aware defaults apply automatically for `dev`, `local`, and `test` profiles (e.g., shorter timeouts, relaxed validation).

---

## 8. Auto-Configuration

**Impact: HIGH** - understanding auto-configured beans prevents duplicate/missing bean errors

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
        // WRONG -- starter already creates this bean
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

---

## 9. Transport Selection

**Impact: HIGH** - wrong transport choice affects performance and compatibility

The SDK auto-selects the best available HTTP transport based on your classpath. Forcing a transport that is not backed by the correct dependency causes runtime failures.

Auto-selection order:

1. **WebClient** (if `spring-webflux` on classpath) -- non-blocking async
2. **RestClient** (if `spring-web` on classpath) -- synchronous with virtual threads
3. **JDK HttpClient** (fallback) -- no Spring dependency needed

Override with: `eventlog.transport: webclient | restclient | jdk`

**Incorrect (forcing webclient without the dependency):**

```yaml
# spring-webflux is NOT on the classpath
eventlog:
  transport: webclient
  # Fails at startup: No qualifying bean of type 'WebClient.Builder'
```

**Correct (match transport to your application type):**

```yaml
# For reactive apps (spring-webflux on classpath):
eventlog:
  transport: webclient

# For traditional Spring MVC with virtual threads:
eventlog:
  transport: restclient

# For minimal dependency footprint:
eventlog:
  transport: jdk
```

In most cases, let auto-selection handle this. Only override the transport when you have a specific reason, such as forcing `jdk` in a non-Spring application or preferring `restclient` in an app that has webflux on the classpath for other reasons.

---

## 10. OAuth Setup

**Impact: HIGH** - missing or incorrect OAuth config prevents API authentication in production

Production deployments use OAuth client credentials flow for API authentication. The SDK handles token caching and proactive refresh automatically. Misconfiguring OAuth or using API keys in production is a security and reliability risk.

**Incorrect (using api-key in production, hardcoding secrets):**

```yaml
# WRONG -- api-key is for development only
eventlog:
  api-key: my-production-key

# WRONG -- never hardcode secrets
eventlog:
  oauth:
    client-secret: my-actual-secret-value
```

**Correct (Spring Boot with externalized secret):**

```yaml
eventlog:
  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read
    refresh-buffer: 60s
```

**Correct (programmatic setup):**

```java
OAuthTokenProvider tokenProvider = OAuthTokenProvider.builder()
    .tokenUrl("https://auth.yourcompany.com/oauth/token")
    .clientId("your-client-id")
    .clientSecret("your-client-secret")
    .scope("eventlog:write eventlog:read")
    .build();

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .tokenProvider(tokenProvider)
    .build();
```

The token is cached until near expiry and refreshed proactively (60s buffer by default). The provider is thread-safe -- multiple threads can share one instance. For dev/testing environments, use `eventlog.api-key: dev-key` instead of OAuth.

---

## 11. Fork-Join Span Links

**Impact: MEDIUM** - enables visualization of parallel step dependencies in trace timelines

When a process has steps that execute in parallel, use the same `step_sequence` for concurrent steps and `spanLinks` on the join step to reference them. This enables the dashboard to visualize fork-join patterns correctly.

**Incorrect (sequential step numbers for parallel steps):**

```java
// WRONG -- implies serial execution when these run in parallel
EventLogEntry odsStep = step(corrId, traceId, processName, 2, "Create ODS Entry")
    .spanId("span-003").parentSpanId("span-002").build();

EventLogEntry regulatoryStep = step(corrId, traceId, processName, 3, "Initialize Regulatory")
    .spanId("span-004").parentSpanId("span-002").build();

EventLogEntry joinStep = step(corrId, traceId, processName, 4, "Background Checks")
    .spanId("span-005").parentSpanId("span-002").build();
```

**Correct (shared step_sequence for parallel steps, spanLinks on join):**

```java
// Parallel steps (both step_sequence = 2)
EventLogEntry odsStep = step(corrId, traceId, processName, 2, "Create ODS Entry")
    .spanId("span-003").parentSpanId("span-002").build();

EventLogEntry regulatoryStep = step(corrId, traceId, processName, 2, "Initialize Regulatory")
    .spanId("span-004").parentSpanId("span-002").build();

// Join step references both parallel steps
EventLogEntry joinStep = step(corrId, traceId, processName, 3, "Background Checks")
    .spanId("span-005").parentSpanId("span-002")
    .spanLinks(List.of("span-003", "span-004"))  // References parallel steps
    .build();
```

Visualization:

```
Step 1 ──┬── Step 2a (ODS)          ──┬── Step 3 (Join)
         └── Step 2b (Regulatory)  ───┘
```

Each parallel step gets its own unique `spanId` but shares the same `step_sequence` number. The downstream join step uses `spanLinks` to declare that it depends on both parallel steps completing.

---

## 12. Batch Operations

**Impact: MEDIUM** - enables monitoring of bulk operations as a cohesive unit

When processing bulk operations (file uploads, batch imports, scheduled jobs), group related events under a shared `batchId`. Each individual event retains its own `correlationId` and `traceId` for independent tracking.

**Incorrect (reusing same correlationId for all batch items):**

```java
// WRONG -- all items share one correlationId, making individual tracking impossible
String corrId = createCorrelationId("emp");
for (CsvRow row : csvRows) {
    processStart(corrId, createTraceId(), "EMPLOYEE_CARD_ORIGINATION")
        .summary("Employee card origination for " + row.getEmployeeId())
        .build();
}
```

**Correct (shared batchId, unique correlationId per item):**

```java
String batchId = createBatchId("hr-upload");

List<EventLogEntry> events = csvRows.stream()
    .map(row -> {
        String corrId = createCorrelationId("emp");
        return processStart(corrId, createTraceId(), "EMPLOYEE_CARD_ORIGINATION")
            .batchId(batchId)
            .applicationId("employee-origination-service")
            .summary("Employee card origination for " + row.getEmployeeId())
            .addIdentifier("employee_id", row.getEmployeeId())
            .build();
    })
    .collect(Collectors.toList());

var response = client.createEvents(events);
```

**Check batch progress:**

```java
var summary = client.getBatchSummary(batchId);
// summary.getCompleted(), summary.getFailed(), summary.getInProgress()
```

The `batchId` ties all events together for aggregate monitoring while each event's unique `correlationId` and `traceId` allow drilling into individual item processing.

---

## 13. Spillover

**Impact: HIGH** - prevents event loss during API outages

Disk spillover persists events to JSONL files when delivery fails. A background replay loop re-delivers events when the API recovers. Without spillover configured, events are permanently dropped during outages.

**Incorrect (no spillover -- events lost during outages):**

```yaml
eventlog:
  async:
    enabled: true
    # No spillover-path -- events dropped when queue is full or API is down
```

**Correct (spillover with size limits):**

```yaml
eventlog:
  async:
    spillover-path: ./spillover
    replay-interval-ms: 10000
    max-spillover-events: 10000
    max-spillover-size-mb: 50
```

**Correct (programmatic configuration):**

```java
AsyncEventLogger logger = AsyncEventLogger.builder()
    .client(eventLogClient)
    .spilloverPath(Path.of("./spillover"))
    .maxSpilloverEvents(10_000)
    .maxSpilloverSizeBytes(50L * 1024 * 1024)
    .replayIntervalMs(10_000)
    .build();
```

Five trigger conditions cause events to spill to disk:

1. **Queue full** -- in-memory queue at capacity
2. **Retries exhausted** -- all retry attempts failed
3. **Circuit breaker open** -- API considered unavailable
4. **Retry requeue failed** -- main queue full during retry
5. **Shutdown stragglers** -- JVM shutdown flushes remaining events

Two-file rotation strategy:

- `eventlog-spillover.jsonl` -- active file for new events
- `eventlog-spillover.replay.jsonl` -- frozen snapshot for replay

The replay loop atomically renames the active file to the replay file, processes it line by line, and deletes it when complete. This prevents duplicate delivery and ensures no events are lost during the rotation.

---

## 14. Circuit Breaker

**Impact: HIGH** - prevents cascading failures when the API is unavailable

The circuit breaker opens after N consecutive failures, routing events to spillover instead of continuing to hit an unavailable API. It resets after a configured timeout, allowing traffic to resume.

**Incorrect (threshold too low -- opens on transient errors):**

```yaml
eventlog:
  async:
    circuit-breaker-threshold: 1   # Opens on a single failure
    circuit-breaker-reset-ms: 5000  # Resets too quickly, causing flapping
```

**Correct (balanced threshold and reset):**

```yaml
eventlog:
  async:
    circuit-breaker-threshold: 5
    circuit-breaker-reset-ms: 30000
```

**Monitoring via Micrometer:**

```bash
curl http://localhost:8080/actuator/metrics/eventlog.circuit-breaker.open
# value: 1 = open, 0 = closed
```

Available metrics:

| Metric | Description |
|--------|-------------|
| eventlog.events.queued | Events accepted into main queue |
| eventlog.events.sent | Events successfully delivered |
| eventlog.events.failed | Events permanently lost |
| eventlog.events.spilled | Events written to spillover disk |
| eventlog.events.replayed | Events replayed from disk |
| eventlog.queue.depth | Current in-memory queue size |
| eventlog.circuit-breaker.open | Circuit breaker state |

If the circuit breaker opens frequently:

- Increase the threshold to tolerate more transient failures
- Verify API availability and network connectivity
- Check for 5xx or 429 responses indicating server-side issues
- Ensure spillover is configured so events are not lost while the circuit is open

---

## 15. Mock Logger for Tests

**Impact: MEDIUM** - enables verifying event logging in unit/integration tests

Use `MockAsyncEventLogger` to capture events in-memory during tests. It is auto-registered when the `test` profile is active. This avoids real HTTP calls while still verifying that events are logged correctly.

**Incorrect (mocking EventLogTemplate directly -- misses async behavior):**

```java
@MockBean
private EventLogTemplate template;  // WRONG -- skips async pipeline entirely

@Test
void logsEvents() {
    orderService.processOrder(order);
    verify(template).log(any());  // Only verifies the template call, not the full flow
}
```

**Correct (Spring Boot integration test with MockAsyncEventLogger):**

```java
@SpringBootTest
@ActiveProfiles("test")
class OrderServiceTest {
    @Autowired
    private MockAsyncEventLogger eventLog;

    @Test
    void logsEvents() {
        orderService.processOrder(order);
        eventLog.assertEventCount(1);
    }
}
```

**Correct (unit test without Spring context):**

```java
MockAsyncEventLogger mockLogger = new MockAsyncEventLogger();
myService.setEventLogger(mockLogger);
myService.doWork();
mockLogger.assertEventCount(2);
```

**Dependency:**

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-test</artifactId>
    <scope>test</scope>
</dependency>
```

The `MockAsyncEventLogger` captures all events submitted through the async pipeline, allowing assertions on event count, field values, and ordering without any network calls or spillover side effects.

---

## 16. Troubleshooting Common Issues

**Impact: MEDIUM** - saves debugging time for common SDK integration problems

A checklist of the most common Event Log SDK integration problems and their solutions.

### SDK Not Logging

```yaml
# Verify these settings:
eventlog:
  enabled: true          # Must be true (default is false)
  base-url: http://...   # Must be set
```

- Confirm the active Spring profile is not overriding `enabled` to `false`
- Check application startup logs for `EventLog auto-configuration disabled`

### Startup Fails

- `base-url` is required when `enabled=true` -- the SDK validates this on startup
- If any OAuth field is set (`token-url`, `client-id`, `client-secret`), all three must be present
- Check for typos in property names (e.g., `baseUrl` vs `base-url`)

### @LogEvent Not Firing

```java
// Ensure all of these are true:
// 1. eventlog-spring-boot-starter is on the classpath
// 2. Spring AOP is enabled (spring-boot-starter-aop dependency)
// 3. eventlog.annotation.enabled is not set to false
// 4. eventlog.application-id or spring.application.name is set
// 5. The annotated method is called from outside its own class (AOP proxy requirement)
```

### Circuit Breaker Opens Frequently

- Increase `circuit-breaker-threshold` (default: 5) to tolerate more transient failures
- Verify API availability: `curl <base-url>/health`
- Check for 5xx or 429 responses in application logs
- Ensure network connectivity between service and Event Log API

### Events Dropped

- Increase `async.queue-capacity` (default: 10000) if the queue fills up
- Enable spillover: set `async.spillover-path` to persist events to disk
- Monitor `eventlog.queue.depth` metric for early warning

### HTTP Timeouts

```yaml
eventlog:
  connect-timeout: 5s     # Default: 2s
  request-timeout: 10s    # Default: 5s
  oauth:
    connect-timeout: 5s   # Separate timeout for token endpoint
    request-timeout: 10s
```

### Metrics Not Showing

- Add `spring-boot-starter-actuator` dependency
- Expose the metrics endpoint: `management.endpoints.web.exposure.include: metrics`
- Verify `eventlog.metrics.enabled` is not set to `false`

### MDC Not Propagating

- Set `eventlog.mdc-filter.url-patterns` to match your API paths (e.g., `"/api/*"`)
- Verify `X-Correlation-ID` and `X-Trace-ID` headers are present in requests
- For async threads, use `MDC.getCopyOfContextMap()` before spawning and `MDC.setContextMap()` inside the new thread

### Serialization Errors

- Ensure Jackson `jackson-databind` and `jackson-datatype-jsr310` modules are on the classpath
- Use the Boot-managed `ObjectMapper` rather than creating a custom instance
- Check that custom payload objects are serializable (public getters or `@JsonProperty` annotations)
