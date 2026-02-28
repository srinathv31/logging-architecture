---
title: Examples
---

# Examples (Feature Coverage)

This document provides concrete examples for every user-facing feature.

## Feature Coverage Map

| Feature | Example Location |
| --- | --- |
| Spring Boot starter auto-config | [Auto-Configuration](/java-sdk/spring-boot/auto-configuration) |
| OAuth client credentials | [OAuth Provider](/java-sdk/core/oauth) |
| API key auth | [Getting Started](/java-sdk/getting-started) |
| Async logging (queue, retry, circuit breaker, spillover) | [AsyncEventLogger](/java-sdk/core/async-event-logger) |
| Sync client calls | [EventLogClient](/java-sdk/core/event-log-client) |
| Batch operations | [Batch Operations](/java-sdk/advanced/batch-operations) |
| Fork-join (span links) | [Fork-Join](/java-sdk/advanced/fork-join) |
| Correlation links | [EventLogClient](/java-sdk/core/event-log-client) |
| Query by account/correlation/trace | [EventLogClient](/java-sdk/core/event-log-client) |
| EventLogTemplate convenience | [EventLogTemplate](/java-sdk/core/event-log-template) |
| Annotation-based logging | [@LogEvent](/java-sdk/spring-boot/annotations) |
| Testing with MockAsyncEventLogger | [Testing](/java-sdk/testing) |

## MDC Context Propagation

```java
import org.slf4j.MDC;

MDC.put("correlationId", correlationId);
MDC.put("traceId", traceId);
MDC.put("spanId", spanId);
MDC.put("parentSpanId", parentSpanId);
MDC.put("batchId", batchId);

// eventLog.log(...) will use MDC values when not explicitly set
```

## Spring Executor Configuration

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

## Advanced Client Configuration (Non-Spring)

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

## Custom Async Executors

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

## Refresh Toggle (Spring Cloud Config)

```yaml
eventlog:
  refresh:
    enabled: false
```

## Testing with MockAsyncEventLogger

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
