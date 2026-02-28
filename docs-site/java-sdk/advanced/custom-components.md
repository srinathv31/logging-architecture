---
title: Custom Components
---

# Custom Components

The SDK allows customizing the ObjectMapper, HttpClient, Transport, and executor implementations.

## Custom ObjectMapper

```java
ObjectMapper mapper = new ObjectMapper();
// configure as needed

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .objectMapper(mapper)
    .build();
```

## Custom HttpClient

```java
HttpClient httpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(5))
    .build();

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .httpClient(httpClient)
    .build();
```

## Custom Transport

```java
EventLogTransport customTransport = /* custom transport impl */;

EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")
    .transport(customTransport)
    .build();
```

## Custom Async Executors

```java
ExecutorService sender = Executors.newFixedThreadPool(2);
ScheduledExecutorService retry = Executors.newSingleThreadScheduledExecutor();

AsyncEventLogger eventLog = AsyncEventLogger.builder()
    .client(client)
    .senderExecutor(sender)
    .retryExecutor(retry)
    .build();
```

## Spring Boot Executor Configuration

### Using Spring's TaskExecutor

```yaml
eventlog:
  async:
    executor: spring
```

```java
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

### Using a Named Bean

```yaml
eventlog:
  async:
    executor: eventlogExecutor
```

```java
@Bean(name = "eventlogExecutor")
public ThreadPoolTaskExecutor eventlogExecutor() { /* ... */ }
```

## Full Custom Client Example

```java
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;

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
