# Java SDK Improvements Checklist

This checklist is derived from `java-sdk/JavaSDKimprovements.md` and is meant to track implementation progress.

## Baseline Compatibility
- [x] Set baseline to Java 21 (`release=21` in build + toolchains documented)
- [x] Target Spring Boot 3.2+ only
- [x] Remove Boot 2.x references (`spring.factories`, `javax.*`)
- [x] Define supported Boot versions (3.2.x, 3.3.x, 3.4.x) and test matrix

## Spring Boot Integration
- [x] Create `eventlog-spring-boot-starter` module
- [x] Implement `EventLogAutoConfiguration`
- [x] Register Boot 3 auto-config (`AutoConfiguration.imports`)
- [x] Add `@ConditionalOnProperty` toggles (`eventlog.enabled=true`)
- [x] Use Boot 3.2 HTTP client facilities (`RestClient.Builder` / `WebClient.Builder`)
- [x] Implement `@PreDestroy` shutdown
- [x] Add `@ConfigurationProperties` class
- [x] Inject Boot-managed `ObjectMapper`
- [x] Integrate with Spring executors (`TaskExecutor`/`TaskScheduler`)
- [x] Add builder hooks for `ObjectMapper`/`HttpClient`/`Executor`
- [x] Avoid blocking async paths (`sendAsync` or virtual-thread executor)
- [x] Support virtual threads (configurable)
- [x] Support Spring Cloud Config

## Configuration
- [x] Create `EventLogProperties` mapped to `eventlog.*`
- [x] Add property validation (`@Validated`, fail fast)
- [x] Implement environment-aware defaults
- [x] Support nested OAuth properties
- [x] Make HTTP timeouts configurable (`connect-timeout`, `request-timeout`)
- [x] Allow executor configuration (`eventlog.async.executor`, `virtual-threads`)
- [x] Use constructor binding (implicit in Boot 3; no annotation required)

## Developer Experience
- [x] Auto-populate `eventTimestamp` in builders
- [x] Add `EventLogTemplate` convenience class
- [x] Add context propagation (MDC/trace)
- [x] Add annotation-based logging (`@LogEvent`)

## Dependency Management
- [x] Fix JetBrains annotations scope
- [x] Mark Jackson as `provided` in starter
- [x] Create `eventlog-sdk-bom`
- [x] Add dependency convergence checks
- [x] Test with Spring Boot 3.2.x / 3.3.x / 3.4.x

## Observability
- [ ] Add Micrometer metrics
- [ ] Add queue depth gauge
- [ ] Implement `HealthIndicator`
- [ ] Add circuit breaker metric
- [ ] Create Grafana dashboard JSON
- [ ] Document alerting rules

## Testing
- [x] Add unit tests for `EventLogClient`
- [x] Add unit tests for `AsyncEventLogger`
- [x] Add unit tests for `EventLogUtils`
- [x] Create `eventlog-test` module
- [x] Implement `MockAsyncEventLogger`
- [x] Add WireMock stubs
- [x] Add integration test profile

## Documentation
- [x] Update README with Spring Boot quick start
- [x] Document all configuration properties
- [x] Add `MIGRATION.md`
- [x] Improve Javadoc coverage
- [x] Create troubleshooting guide
- [x] Add architecture diagram
