---
title: Testing with MockAsyncEventLogger
impact: MEDIUM
impactDescription: enables verifying event logging in unit/integration tests
tags: test, mock, logger, assertions
---

## Testing with MockAsyncEventLogger

Use `MockAsyncEventLogger` to capture events in-memory during tests. It is auto-registered when the `test` profile is active. This avoids real HTTP calls while still verifying that events are logged correctly.

**Incorrect (mocking EventLogTemplate directly — misses async behavior):**

```java
@MockBean
private EventLogTemplate template;  // WRONG — skips async pipeline entirely

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
