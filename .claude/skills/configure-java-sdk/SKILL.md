---
name: configure-java-sdk
description: Walk through adding the Event Log Java SDK to a Spring Boot application with dependency, YAML config, EventLogTemplate usage, MDC setup, and verification.
user-invokable: true
argument-hint: "Spring Boot service name"
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Configure Event Log Java SDK

Walk through adding the Event Log SDK to a Spring Boot application.

## Step 1: Add the Dependency

**Maven:**
```xml
<dependency>
    <groupId>com.yourorg</groupId>
    <artifactId>event-log-spring-boot-starter</artifactId>
    <version>${event-log.version}</version>
</dependency>
```

**Gradle:**
```groovy
implementation "com.yourorg:event-log-spring-boot-starter:${eventLogVersion}"
```

For testing, also add:
```xml
<dependency>
    <groupId>com.yourorg</groupId>
    <artifactId>eventlog-test</artifactId>
    <scope>test</scope>
</dependency>
```

## Step 2: Configure application.yml

### Local Development

```yaml
eventlog:
  enabled: true
  base-url: http://localhost:3000
  api-key: dev-key
  application-id: <service-name>
  mdc-filter:
    url-patterns: "/api/*"
```

### Production

```yaml
eventlog:
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: <service-name>
  target-system: <service-name>
  originating-system: <service-name>

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

Key rules:
- When `enabled=true`, `base-url` is mandatory
- Never hardcode `client-secret` — use environment variables
- Use `api-key` only in dev/test, OAuth in production

## Step 3: Inject and Use EventLogTemplate

```java
@Service
public class MyService {
    private final EventLogTemplate template;

    public MyService(EventLogTemplate template) {
        this.template = template;
    }

    public void processItem(Item item) {
        ProcessLogger process = template.forProcess("ITEM_PROCESSING")
            .addIdentifier("itemId", item.getId());

        process.processStart("Processing item " + item.getId(), "INITIATED");

        try {
            var result = doWork(item);
            process.logStep(1, "Process Item", EventStatus.SUCCESS, "Done", "PROCESSED");
            process.processEnd(2, EventStatus.SUCCESS, "Complete", "COMPLETED", result.getDurationMs());
        } catch (BusinessException e) {
            process.withErrorCode(e.getCode()).withErrorMessage(e.getMessage())
                .logStep(1, "Process Item", EventStatus.FAILURE, "Failed", "FAILED");
            process.processEnd(2, EventStatus.FAILURE, "Item failed", "FAILED", null);
            throw e;
        } catch (Exception e) {
            process.error("UNHANDLED_ERROR", e.getMessage(), "Unexpected error", "FAILED");
            throw e;
        }
    }
}
```

## Step 4: Set Up MDC (if not using the auto-filter)

If you need custom MDC setup beyond the auto-filter:

```java
MDC.put("correlationId", EventLogUtils.createCorrelationId("myapp"));
MDC.put("traceId", EventLogUtils.createTraceId());
```

## Step 5: Verify

1. Start the app — check logs for `EventLog auto-configuration` messages
2. Trigger a process — verify events appear in the Event Log API
3. Check that `correlationId` and `traceId` are populated (from MDC)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| SDK not logging | Check `eventlog.enabled=true` and `base-url` is set |
| @LogEvent not firing | Verify starter on classpath, AOP enabled, `application-id` set, method called externally |
| Missing correlation ID | Set `eventlog.mdc-filter.url-patterns` or add MDC manually |
| Startup failure | Ensure `base-url` set when `enabled=true`; if OAuth configured, all 3 fields required |
| Events dropped | Enable spillover: `async.spillover-path`, increase `queue-capacity` |

## Checklist

- [ ] `event-log-spring-boot-starter` dependency added
- [ ] `eventlog.enabled: true` and `base-url` configured
- [ ] `application-id` set (or `spring.application.name`)
- [ ] MDC filter configured for API paths
- [ ] OAuth configured for production (not `api-key`)
- [ ] Spillover path set for resilience
- [ ] `eventlog-test` dependency added for test scope
