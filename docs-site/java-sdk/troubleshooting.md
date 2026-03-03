---
title: Troubleshooting
---

# Troubleshooting

## SDK Not Logging Anything

- Ensure `eventlog.enabled=true`.
- Ensure `eventlog.base-url` is set.
- Verify the Spring profile you run has these properties.

## Startup Fails with Validation Errors

- `eventlog.base-url` is required when `eventlog.enabled=true`.
- OAuth requires `eventlog.oauth.token-url`, `client-id`, and `client-secret` if any OAuth field is set.

## @LogEvent Not Firing

- Ensure the Spring Boot starter dependency is used.
- Ensure AOP is enabled (starter includes it by default).
- Check `eventlog.annotation.enabled` is not set to `false`.
- Ensure `eventlog.application-id` or `spring.application.name` is set.

## Circuit Breaker Opens Frequently

- Increase `eventlog.async.circuit-breaker-threshold`.
- Verify API availability and network connectivity.
- Check if retries are exhausted due to 5xx/429 responses.

## Events Dropped

- Increase `eventlog.async.queue-capacity`.
- Enable spillover: `eventlog.async.spillover-path=/path/to/dir`.
- Monitor queue depth once metrics are enabled.

## Async Logging Uses Too Many Threads

- Configure a shared executor using `eventlog.async.executor`.
- Disable virtual threads if using custom executors.

## HTTP Timeouts

- Increase `eventlog.connect-timeout` and `eventlog.request-timeout`.
- For OAuth, also adjust `eventlog.oauth.connect-timeout` and `eventlog.oauth.request-timeout`.

## Metrics Not Showing in Actuator

- Ensure `spring-boot-starter-actuator` is in your `pom.xml`.
- Verify the metrics endpoint is exposed:
  ```yaml
  management:
    endpoints:
      web:
        exposure:
          include: health,metrics
  ```
- Check that `eventlog.metrics.enabled` is not set to `false` (it defaults to `true`).
- Confirm Micrometer is on the classpath (included by the actuator starter).
- Query `curl http://localhost:8080/actuator/metrics` and look for names starting with `eventlog.`.
- See the [Application YAML Guide — Metrics & Actuator](/java-sdk/spring-boot/application-yml-guide#metrics-actuator) for the complete setup.

## MDC Values Not Propagating

- Ensure `eventlog.mdc-filter.url-patterns` is set and matches your request paths:
  ```yaml
  eventlog:
    mdc-filter:
      url-patterns: "/api/*"
  ```
- Verify your URLs match the pattern — the filter only applies to matching paths.
- Check that `correlationId` and `traceId` are present in the incoming request headers.
- If using async processing, MDC values may not propagate to child threads. Use `MDC.getCopyOfContextMap()` and set it on the child thread.

## Serialization Errors

- If using Spring Boot, ensure Jackson modules are on the classpath.
- Prefer injecting Boot-managed `ObjectMapper` via the starter.
