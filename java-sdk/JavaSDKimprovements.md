# Java SDK Improvements Roadmap

This document outlines improvements to make the Event Log Java SDK production-ready and seamless for Spring Boot applications.

---

## Table of Contents

1. [Baseline Compatibility](#1-baseline-compatibility)
2. [Spring Boot Integration](#2-spring-boot-integration)
3. [Configuration](#3-configuration)
4. [Developer Experience](#4-developer-experience)
5. [Dependency Management](#5-dependency-management)
6. [Observability](#6-observability)
7. [Testing](#7-testing)
8. [Documentation](#8-documentation)

---

## 1. Baseline Compatibility

### Current State
- Compatibility not explicitly defined
- Some guidance implies Spring Boot 2.x support

### Desired State
- Java 21+ only
- Spring Boot 3.2+ only
- Use `jakarta.*` APIs where applicable

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Set baseline to Java 21 | Maven/Gradle compiler `release=21` and toolchains documented |
| **P0** | Target Spring Boot 3.2+ | Dependencies and auto-config only for Boot 3.2+ |
| **P0** | Remove Boot 2.x references | No `spring.factories` auto-config, no `javax.*` |
| **P1** | Define supported Boot versions | Test matrix includes 3.2.x, 3.3.x, 3.4.x |

---

## 2. Spring Boot Integration

### Current State
- SDK is a plain Java library with no Spring awareness
- Consumers must manually instantiate `EventLogClient` and `AsyncEventLogger`
- No auto-configuration or lifecycle management
- Shutdown hooks registered manually via JVM runtime
- Async client methods use `CompletableFuture.supplyAsync` with blocking calls and no executor control

### Desired State
- Drop-in Spring Boot starter that auto-configures everything
- Beans created and managed by Spring container
- Proper lifecycle integration (graceful shutdown via `@PreDestroy`)
- Support for Spring profiles (dev, staging, prod)
- Spring Boot 3.2-native HTTP and tracing integration

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Create `eventlog-spring-boot-starter` module | New Maven module with `spring-boot-starter` packaging |
| **P0** | Implement `EventLogAutoConfiguration` class | Auto-creates `EventLogClient` and `AsyncEventLogger` beans when on classpath |
| **P0** | Register Boot 3 auto-config | Add `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` |
| **P0** | Add `@ConditionalOnProperty` toggles | SDK disabled by default in tests, enabled in prod via `eventlog.enabled=true` |
| **P0** | Use Boot 3.2 HTTP client facilities | Prefer `RestClient.Builder` (or `WebClient.Builder`) when on classpath; fallback to JDK `HttpClient` |
| **P1** | Implement `@PreDestroy` shutdown | `AsyncEventLogger.shutdown()` called by Spring, not JVM hook |
| **P1** | Add `@ConfigurationProperties` class | Type-safe configuration with IDE auto-completion |
| **P1** | Inject Boot-managed `ObjectMapper` | Use Boot `ObjectMapper` (modules, naming strategy, date config) instead of creating a new one |
| **P1** | Integrate with Spring executors | Use `TaskExecutor`/`TaskScheduler` beans for async sending/retries; avoid common pool |
| **P1** | Avoid blocking async paths | Replace `CompletableFuture.supplyAsync` with `HttpClient.sendAsync` or virtual-thread executor |
| **P1** | Support virtual threads | If enabled, use `VirtualThreadTaskExecutor` (Spring) or `Executors.newVirtualThreadPerTaskExecutor()` |
| **P2** | Support Spring Cloud Config | Reload configuration without restart |

### Example Usage (After)
```java
// application.yml
eventlog:
  enabled: true
  base-url: ${EVENTLOG_API_URL}
  oauth:
    token-url: ${OAUTH_TOKEN_URL}
    client-id: ${OAUTH_CLIENT_ID}
    client-secret: ${OAUTH_CLIENT_SECRET}

// Service.java - just inject and use
@Service
public class MyService {
    private final AsyncEventLogger eventLog;

    public MyService(AsyncEventLogger eventLog) {
        this.eventLog = eventLog;
    }
}
```

---

## 3. Configuration

### Current State
- All configuration via builder pattern in code
- No support for external configuration files
- Environment variables require manual reading
- No sensible defaults for different environments
- Client request timeout is hard-coded in code

### Desired State
- Configuration via `application.properties` or `application.yml`
- Environment-specific defaults (shorter timeouts in dev, longer in prod)
- Support for Spring profiles
- Validation of required properties at startup
- Configurable HTTP timeouts and async executors

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Create `EventLogProperties` class | Maps all builder options to `eventlog.*` properties |
| **P0** | Add property validation | Startup fails fast with clear message if `base-url` missing |
| **P1** | Implement environment-aware defaults | Different `queue-capacity`, `timeout` defaults per profile |
| **P1** | Support nested OAuth properties | `eventlog.oauth.token-url`, `eventlog.oauth.client-id`, etc. |
| **P1** | Make HTTP timeouts configurable | Separate `connect-timeout` and `request-timeout` properties |
| **P1** | Allow executor configuration | `eventlog.async.executor` / `eventlog.async.virtual-threads` toggles |
| **P2** | Use constructor binding (implicit in Boot 3) | Prevents runtime modification of config without requiring `@ConstructorBinding` |

### Configuration Properties

```yaml
eventlog:
  # Required
  base-url: https://eventlog-api.example.com

  # OAuth (recommended for production)
  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read

  # Or static API key (development only)
  api-key: ${EVENTLOG_API_KEY:}

  # Client settings
  application-id: my-service
  # Optional: webclient | restclient | jdk (auto-select if omitted)
  transport: webclient
  connect-timeout: 10s
  request-timeout: 30s
  max-retries: 3
  retry-delay: 500ms

  # Async logger settings
  async:
    enabled: true
    queue-capacity: 10000
    base-retry-delay: 1s
    max-retry-delay: 30s
    circuit-breaker-threshold: 5
    circuit-breaker-reset: 30s
    spillover-path: /var/log/eventlog-spillover
    virtual-threads: true
```

---

## 4. Developer Experience

### Current State
- Verbose builder patterns for common operations
- Developers must remember to set `eventTimestamp`
- No convenience methods for common patterns
- Error handling requires try-catch on every call

### Desired State
- Simple one-liner APIs for common logging patterns
- Automatic timestamp population
- Fluent API for adding context
- Optional callbacks instead of try-catch

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Auto-populate `eventTimestamp` in builders | Timestamp defaults to `Instant.now()` if not set |
| **P1** | Add `EventLogTemplate` convenience class | Single method calls for common patterns |
| **P1** | Add context propagation support | Automatically capture MDC/trace context |
| **P2** | Add annotation-based logging | `@LogEvent` on methods for automatic step logging |
| **P2** | Add Kotlin extensions | Idiomatic Kotlin DSL for Kotlin consumers |

### Example: EventLogTemplate

```java
@Component
public class MyService {
    private final EventLogTemplate eventLog;

    public void processOrder(Order order) {
        // Simple one-liner instead of builder
        eventLog.logStep("ORDER_PROCESSING", 1, "Validate Order",
            EventStatus.SUCCESS, "Order validated for customer " + order.getCustomerId());

        // Or with fluent context
        eventLog.forProcess("ORDER_PROCESSING")
            .withCorrelationId(order.getOrderId())
            .logStep(1, "Validate Order", EventStatus.SUCCESS, "Order validated");
    }
}
```

### Example: Annotation-Based Logging (P2)

```java
@Service
public class OrderService {

    @LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Validate Order")
    public ValidationResult validateOrder(Order order) {
        // Method execution automatically logged with timing
        return doValidation(order);
    }
}
```

---

## 5. Dependency Management

### Current State
- JetBrains annotations at `compile` scope (should be `provided`)
- Jackson version may conflict with Spring Boot managed versions
- No BOM (Bill of Materials) for version management
- `slf4j-simple` in test scope but consumers may have different SLF4J binding

### Desired State
- All optional dependencies marked appropriately
- Jackson version aligned with Spring Boot or declared optional
- BOM for multi-module consumers
- Clear dependency on SLF4J API only

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Fix JetBrains annotations scope | Change to `<scope>provided</scope>` or `<optional>true</optional>` |
| **P0** | Mark Jackson as `provided` in starter | Spring Boot manages Jackson version |
| **P1** | Create `eventlog-sdk-bom` module | Single place to manage all SDK module versions |
| **P1** | Add dependency convergence checks | Build fails if transitive conflicts detected |
| **P2** | Test with multiple Spring Boot versions | Matrix test: 3.2.x, 3.3.x, 3.4.x |

### Updated pom.xml (Core SDK)

```xml
<!-- Optional annotations - no runtime impact -->
<dependency>
    <groupId>org.jetbrains</groupId>
    <artifactId>annotations</artifactId>
    <version>24.1.0</version>
    <scope>provided</scope>
</dependency>

<!-- Jackson - provided by Spring Boot or consumer -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <scope>provided</scope>
</dependency>
```

---

## 6. Observability

### Current State
- `AsyncEventLogger.Metrics` class exists but not exposed to monitoring systems
- No Micrometer integration
- No health check endpoint
- Circuit breaker state not visible externally

### Desired State
- Micrometer metrics auto-registered when on classpath
- Spring Boot Actuator health indicator
- Metrics dashboard templates (Grafana)
- Alerting recommendations

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Add Micrometer metrics | Counters: `eventlog.events.queued`, `eventlog.events.sent`, `eventlog.events.failed` |
| **P0** | Add gauge for queue depth | `eventlog.queue.depth` gauge |
| **P1** | Implement `HealthIndicator` | Reports DOWN when circuit breaker open |
| **P1** | Add circuit breaker metric | `eventlog.circuit.open` gauge (0/1) |
| **P2** | Create Grafana dashboard JSON | Pre-built dashboard for common metrics |
| **P2** | Document alerting rules | Prometheus alert rules for failures, queue depth |

### Metrics to Expose

```
# Counters
eventlog_events_queued_total
eventlog_events_sent_total
eventlog_events_failed_total
eventlog_events_spilled_total

# Gauges
eventlog_queue_depth
eventlog_circuit_open

# Timers
eventlog_send_duration_seconds
```

### Health Indicator Example

```java
@Component
@ConditionalOnClass(HealthIndicator.class)
public class EventLogHealthIndicator implements HealthIndicator {
    private final AsyncEventLogger logger;

    @Override
    public Health health() {
        var metrics = logger.getMetrics();

        if (metrics.circuitOpen) {
            return Health.down()
                .withDetail("reason", "Circuit breaker open")
                .withDetail("queueDepth", metrics.currentQueueDepth)
                .build();
        }

        return Health.up()
            .withDetail("queueDepth", metrics.currentQueueDepth)
            .withDetail("eventsSent", metrics.eventsSent)
            .build();
    }
}
```

---

## 7. Testing

### Current State
- No unit tests in SDK
- No test utilities for SDK consumers
- No mock/fake implementations for testing
- Consumers must mock `EventLogClient` themselves

### Desired State
- Comprehensive unit tests for SDK (90%+ coverage)
- `eventlog-test` module with test utilities
- `MockAsyncEventLogger` for consumer tests
- Integration test support with WireMock stubs

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Add unit tests for `EventLogClient` | Test retry logic, error handling, URL building |
| **P0** | Add unit tests for `AsyncEventLogger` | Test queue, circuit breaker, spillover |
| **P0** | Add unit tests for `EventLogUtils` | Test ID generation, summary helpers |
| **P1** | Create `eventlog-test` module | Test utilities as separate dependency |
| **P1** | Implement `MockAsyncEventLogger` | In-memory logger that captures events for assertions |
| **P2** | Add WireMock stubs | Pre-configured stubs for common API responses |
| **P2** | Add integration test profile | Auto-configure mock logger in test profile |

### Test Utilities Module

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-test</artifactId>
    <version>1.4.0</version>
    <scope>test</scope>
</dependency>
```

### MockAsyncEventLogger

```java
public class MockAsyncEventLogger extends AsyncEventLogger {
    private final List<EventLogEntry> capturedEvents = new ArrayList<>();

    @Override
    public boolean log(EventLogEntry event) {
        capturedEvents.add(event);
        return true;
    }

    // Assertion helpers
    public void assertEventLogged(String correlationId) { ... }
    public void assertEventCount(int expected) { ... }
    public List<EventLogEntry> getEventsForProcess(String processName) { ... }
    public void reset() { capturedEvents.clear(); }
}
```

### Consumer Test Example

```java
@SpringBootTest
@Import(EventLogTestConfiguration.class)  // Auto-imports MockAsyncEventLogger
class OrderServiceTest {

    @Autowired
    private MockAsyncEventLogger eventLog;

    @Autowired
    private OrderService orderService;

    @Test
    void shouldLogOrderProcessingEvents() {
        orderService.processOrder(new Order("ORD-123"));

        eventLog.assertEventCount(3);
        eventLog.assertEventLogged("ORDER_PROCESSING", EventType.PROCESS_START);
        eventLog.assertEventLogged("ORDER_PROCESSING", EventType.PROCESS_END);
    }

    @AfterEach
    void cleanup() {
        eventLog.reset();
    }
}
```

---

## 8. Documentation

### Current State
- README covers basic usage
- No Spring Boot specific documentation
- Examples in `examples/` package but not highlighted
- No migration guide from manual setup to starter

### Desired State
- Comprehensive README with Spring Boot quick start
- Dedicated Spring Boot integration guide
- Javadoc on all public APIs
- Migration guide for existing consumers

### Action Items

| Priority | Item | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | Update README with Spring Boot quick start | First example shows Spring Boot usage |
| **P0** | Document all configuration properties | Table with property, type, default, description |
| **P1** | Add MIGRATION.md | Step-by-step guide from manual to auto-config |
| **P1** | Improve Javadoc coverage | All public classes/methods documented |
| **P2** | Create troubleshooting guide | Common issues and solutions |
| **P2** | Add architecture diagram | Show async flow, circuit breaker, spillover |

### README Structure (Proposed)

```
# Event Log SDK for Java

## Quick Start (Spring Boot)
[5 lines to get started with Spring Boot]

## Quick Start (Plain Java)
[For non-Spring applications]

## Configuration Reference
[Full property documentation]

## API Reference
- EventLogClient
- AsyncEventLogger
- EventLogTemplate

## Advanced Topics
- Circuit Breaker
- Spillover Recovery
- Distributed Tracing Integration

## Testing
[How to test with MockAsyncEventLogger]

## Troubleshooting
[Common issues]
```

---

## Implementation Phases

### Phase 1: Foundation (P0 items)
- Fix dependency scopes
- Add unit tests
- Auto-populate timestamps
- Create Spring Boot starter with basic auto-configuration
- Update README with Spring Boot quick start

### Phase 2: Production Ready (P1 items)
- Full configuration properties support
- Micrometer metrics
- Health indicator
- Test utilities module
- Migration guide

### Phase 3: Polish (P2 items)
- Annotation-based logging
- Kotlin extensions
- Grafana dashboards
- Spring Boot version matrix testing
- Architecture diagrams

---

## Module Structure (Final)

```
java-sdk/
├── eventlog-sdk/                    # Core SDK (no Spring dependency)
│   └── pom.xml
├── eventlog-spring-boot-starter/    # Spring Boot auto-configuration
│   └── pom.xml
├── eventlog-test/                   # Test utilities
│   └── pom.xml
├── eventlog-bom/                    # Bill of Materials
│   └── pom.xml
└── pom.xml                          # Parent POM
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test coverage | > 90% |
| Spring Boot integration time | < 5 minutes |
| Configuration properties | 100% documented |
| Breaking changes | 0 (backward compatible) |
