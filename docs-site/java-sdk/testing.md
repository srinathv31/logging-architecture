---
title: Testing
---

# Testing

Use the `eventlog-test` module to capture events in-memory during tests.

## Dependency

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-test</artifactId>
    <version>1.0.0</version>
    <scope>test</scope>
</dependency>
```

## MockAsyncEventLogger

With the `test` profile active, `MockAsyncEventLogger` is auto-registered as the `AsyncEventLogger` bean. Activate it via `@ActiveProfiles("test")` or `spring.profiles.active=test`.

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
        // call your service
        orderService.processOrder(order);

        // assert events were logged
        eventLog.assertEventCount(1);
    }
}
```

## Manual Instantiation

You can also instantiate `MockAsyncEventLogger` directly without Spring:

```java
MockAsyncEventLogger mockLogger = new MockAsyncEventLogger();

// Use in your code under test
myService.setEventLogger(mockLogger);
myService.doWork();

// Verify
mockLogger.assertEventCount(2);
```
