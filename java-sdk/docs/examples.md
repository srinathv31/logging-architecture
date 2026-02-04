# Event Log SDK Examples (Feature Coverage)

This document ensures every user‑facing feature has at least one concrete example.

## Feature Coverage Map

| Feature | Example Location |
| --- | --- |
| Spring Boot starter auto‑config | `README.md` (Spring Boot Auto‑Configuration + Bean Injection) |
| OAuth client credentials | `README.md` (Quick Start) + `src/main/java/com/eventlog/sdk/examples/RealTimeLoggingExample.java` |
| API key auth | `README.md` (Quick Start) + `src/main/java/com/eventlog/sdk/examples/QuickStartExample.java` |
| Async logging (queue, retry, circuit breaker, spillover) | `README.md` (AsyncEventLogger Features) + `RealTimeLoggingExample.java` |
| Sync client calls | `README.md` (Synchronous Client) |
| Async client calls | `README.md` (Async Operations) |
| Batch operations | `README.md` (Batch Operations) + `QuickStartExample.java` |
| Fork‑join (span links) | `README.md` (Fork‑Join Pattern) + `QuickStartExample.java` |
| Correlation links | `README.md` (Correlation Links) |
| Query by account/correlation/trace | `README.md` (Querying Events) |
| EventLogTemplate convenience | `README.md` (EventLogTemplate Convenience) |
| Annotation‑based logging | `README.md` (Annotation‑Based Logging) + `MIGRATION.md` |
| MDC context propagation | `docs/examples.md` (MDC Example) |
| Custom executors (Spring Boot) | `docs/examples.md` (Spring Executor Example) |
| Custom client components (ObjectMapper/HttpClient/Transport) | `docs/examples.md` (Advanced Client Configuration) |
| Custom AsyncEventLogger executors | `docs/examples.md` (Async Executors Example) |
| Spring Cloud Config refresh toggle | `docs/examples.md` (Refresh Toggle Example) |
| Testing with MockAsyncEventLogger | `docs/examples.md` (Testing Example) |

## MDC Example (Context Propagation)

```java
import org.slf4j.MDC;

MDC.put("correlationId", correlationId);
MDC.put("traceId", traceId);
MDC.put("spanId", spanId);
MDC.put("parentSpanId", parentSpanId);
MDC.put("batchId", batchId);

// eventLog.log(...) will use MDC values when not explicitly set
```

## Spring Executor Example (Boot Starter)

```yaml
eventlog:
  enabled: true
  async:
    executor: spring
```

```java
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Bean
public ThreadPoolTaskExecutor eventLogTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(16);
    executor.setQueueCapacity(1000);
    executor.setThreadNamePrefix("eventlog-");
    executor.initialize();
    return executor;
}
```

Use a named bean instead:

```yaml
eventlog:
  async:
    executor: eventlogExecutor
```

```java
@Bean(name = "eventlogExecutor")
public ThreadPoolTaskExecutor eventlogExecutor() { /* ... */ }
```

## Advanced Client Configuration (Non‑Spring)

```java
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

ObjectMapper mapper = new ObjectMapper();
HttpClient httpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(5))
    .build();
Executor asyncExecutor = Executors.newSingleThreadExecutor();
EventLogTransport customTransport = /* custom transport impl */;

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .tokenProvider(OAuthTokenProvider.builder()
        .tokenUrl("https://auth.example.com/oauth/token")
        .clientId("client")
        .clientSecret("secret")
        .build())
    .objectMapper(mapper)
    .httpClient(httpClient)
    .asyncExecutor(asyncExecutor)
    .transport(customTransport)
    .build();
```

## Async Executors Example (Custom Schedulers)

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

ExecutorService sender = Executors.newFixedThreadPool(2);
ScheduledExecutorService retry = Executors.newSingleThreadScheduledExecutor();

AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .senderExecutor(sender)
    .retryExecutor(retry)
    .build();
```

## Refresh Toggle Example (Spring Cloud Config)

```yaml
eventlog:
  refresh:
    enabled: false
```

## Testing Example (MockAsyncEventLogger)

```java
import com.eventlog.sdk.test.MockAsyncEventLogger;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class OrderServiceTest {
    @Autowired
    private MockAsyncEventLogger eventLog;

    @Test
    void logsEvents() {
        // call service
        eventLog.assertEventCount(1);
    }
}
```

