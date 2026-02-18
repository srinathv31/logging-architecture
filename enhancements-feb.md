# Event Log Platform — February 2026 Enhancements

Quality improvements identified from a deep-dive review of the API, Java SDK, and pet-resort-api gold standard. Each issue is evaluated against four principles: **ease of use**, **ease of setup**, **non-blocking**, and **performance**.

**Out of scope (noted for future):** API authentication, DELETE endpoint protection, connection pool rotation on Azure AD token refresh, .env.example documentation, account_timeline_summary population docs.

---

## Java SDK

### 1. [HIGH] Add `spanLinks` support to ProcessLogger

**Principles:** Ease of Use

**Problem:** ProcessLogger has zero support for `spanLinks`. The field exists on `EventLogEntry` (`EventLogEntry.java:52`, builder at line 308) but ProcessLogger's `baseBuilder()` at `EventLogTemplate.java:511-530` never sets it. The pet-resort-api's fork-join pattern (`BookingService.java:253-278`) is forced to abandon ProcessLogger entirely and use a raw `EventLogEntry.builder()` with 15+ manually repeated fields just to set `spanLinks`. This is the single biggest developer experience gap — fork-join is a common microservice pattern.

**Fix:** Add one-shot (per-event, auto-clearing) spanLinks support to ProcessLogger.

- [ ] Add field to ProcessLogger: `private List<String> pendingSpanLinks`
- [ ] Add fluent setter: `withSpanLinks(List<String>)` — replaces any pending links, returns `this`
- [ ] Add accumulator: `addSpanLink(String spanId)` — appends one link, returns `this`
- [ ] Wire into `baseBuilder()`: if `pendingSpanLinks` is non-empty, call `builder.spanLinks(new ArrayList<>(pendingSpanLinks))`
- [ ] Clear `pendingSpanLinks` after each event emission (`logStep`, `processEnd`, `processStart`, `error`) so links don't leak to subsequent steps — same one-shot pattern as how `spanIdOverride` works at line 436-457
- [ ] Add unit tests: spanLinks set before logStep appears on that event only, not on subsequent events
- [ ] Add unit test: addSpanLink accumulates across multiple calls before a single logStep

**Files:** `java-sdk/eventlog-sdk/src/main/java/com/eventlog/sdk/template/EventLogTemplate.java`, `java-sdk/eventlog-sdk/src/test/java/com/eventlog/sdk/template/EventLogTemplateTest.java`

---

### 2. [HIGH] Batch sender — increase SDK throughput

**Principles:** Performance, Non-Blocking

**Problem:** `AsyncEventLogger` uses a single sender thread (`Executors.newSingleThreadExecutor()` at `AsyncEventLogger.java:138`) that polls one event at a time (`queue.poll()` at line 310) and sends it synchronously via `client.createEvent()` at line 329. SDK throughput is capped at `1 / (network_latency + API_processing_time)` events/sec. With a 20ms round-trip, that's ~50 events/sec max. High-volume teams will fill the 10k queue and start dropping events.

**Fix:** Batch-drain the queue and send via the batch API endpoint.

- [ ] Add `drainTo()` logic in `senderLoop()`: replace `queue.poll(100ms)` with `queue.drainTo(batch, maxBatchSize)` where `maxBatchSize` is configurable (default 50)
- [ ] If `drainTo` returns 0 (queue empty), fall back to `queue.poll(100ms)` to block briefly and avoid busy-spinning
- [ ] Call `client.createEvents(batch)` (the batch endpoint) instead of `client.createEvent(single)` — this method already exists on `EventLogClient`
- [ ] Handle partial batch failures from the batch response: retry only the failed items (using the `errors[]` array from the API response)
- [ ] Add builder config: `batchSize(int)` with default 50, `maxBatchWaitMs(long)` with default 100 (max time to accumulate before sending a partial batch)
- [ ] Add configurable sender thread count: `senderThreads(int)` default 1. Submit N `senderLoop` tasks to the executor. Queue is already thread-safe (`LinkedBlockingQueue`)
- [ ] Add Spring Boot properties: `eventlog.async.batch-size` and `eventlog.async.sender-threads`
- [ ] Update existing tests; add throughput test verifying batch mode sends fewer HTTP calls than single mode
- [ ] Preserve backwards compatibility: `batchSize(1)` should behave identically to current single-send behavior

**Files:** `java-sdk/eventlog-sdk/src/main/java/com/eventlog/sdk/client/AsyncEventLogger.java`, `java-sdk/eventlog-sdk/src/test/java/com/eventlog/sdk/client/AsyncEventLoggerTest.java`, `java-sdk/eventlog-spring-boot-starter/src/main/java/com/eventlog/sdk/autoconfigure/EventLogProperties.java`, `java-sdk/eventlog-spring-boot-starter/src/main/java/com/eventlog/sdk/autoconfigure/EventLogAutoConfiguration.java`

---

### 3. [HIGH] Make `withTargetSystem()` per-step instead of sticky

**Principles:** Ease of Use

**Problem:** `withTargetSystem()` at `EventLogTemplate.java:334-337` permanently mutates `targetSystemOverride` on the ProcessLogger. Every subsequent step inherits the last target system set. The pet-resort-api has to call `withTargetSystem()` before every single step (`BookingService.java` lines 118, 138, 163, 183, 196) or risk mislabeling. If a developer forgets one call, events silently get tagged to the wrong system.

**Fix:** Make it work as "default + per-step override". The template-level `targetSystem` is always the fallback. `withTargetSystem()` on ProcessLogger sets a per-step override that auto-clears after the next event emission.

- [ ] Change `withTargetSystem()` to set a `pendingTargetSystem` field (not `targetSystemOverride`)
- [ ] In `baseBuilder()`: use `pendingTargetSystem` if set, else fall back to the template's `targetSystem`
- [ ] Clear `pendingTargetSystem` after each event emission (same one-shot pattern as proposed for spanLinks)
- [ ] Add `withDefaultTargetSystem(String)` for teams that want a sticky ProcessLogger-level override (preserves current behavior for those who explicitly need it)
- [ ] Update unit tests: verify target system reverts to template default after each step
- [ ] Add test: `withDefaultTargetSystem` persists across steps, `withTargetSystem` does not

**Files:** `java-sdk/eventlog-sdk/src/main/java/com/eventlog/sdk/template/EventLogTemplate.java`, `java-sdk/eventlog-sdk/src/test/java/com/eventlog/sdk/template/EventLogTemplateTest.java`

---

### 4. [MEDIUM] Ship MDC filter in the Spring Boot starter

**Principles:** Ease of Setup

**Problem:** Every team that adopts the SDK must copy-paste the same ~60-line `EventLogMdcFilter` from the pet-resort-api. The filter is identical across all consumers — only the URL pattern varies.

**What is the MDC filter?** A servlet filter that runs first on every request, reads `X-Correlation-Id`, `X-Trace-Id`, `X-Span-Id` from request headers (generating new ones via `EventLogUtils` if absent), puts them in SLF4J MDC, echoes them on the response, and clears MDC in `finally`. The SDK's `MdcContextProvider` then reads these automatically — services never pass IDs explicitly.

**Fix:** Move the filter into `eventlog-spring-boot-starter` with configurable properties.

- [ ] Create `EventLogMdcFilter` in the starter module (same logic as pet-resort-api's, minus `X-Simulate` which is demo-specific)
- [ ] Add `EventLogProperties.MdcFilter` nested config class: `enabled` (default true), `urlPatterns` (default `"/*"`), `order` (default 1), `correlationHeader`, `traceHeader`, `spanHeader` (with standard defaults)
- [ ] Add `FilterRegistrationBean<EventLogMdcFilter>` bean in `EventLogAutoConfiguration` with guards: `@ConditionalOnWebApplication(SERVLET)`, `@ConditionalOnMissingBean(EventLogMdcFilter.class)`, `@ConditionalOnProperty(eventlog.mdc-filter.enabled, default true)`
- [ ] `@ConditionalOnMissingBean` allows teams to supply their own filter if they need custom behavior
- [ ] Add tests: filter auto-registers and populates MDC; disabled when property is false; custom bean takes precedence
- [ ] Document: what headers are read, what MDC keys are set, how to customize

**Files:** new class in `java-sdk/eventlog-spring-boot-starter/`, `EventLogProperties.java`, `EventLogAutoConfiguration.java`

---

### 5. [MEDIUM] Reduce event-loss risk

**Principles:** Non-Blocking, Ease of Use

**Problem:** `AsyncEventLogger.log()` returns `boolean` indicating queue acceptance, but every call in the pet-resort-api (11 calls in `checkOut` alone, e.g., `BookingService.java:278`) ignores the return value. If the queue is full, events are silently dropped. The `eventsFailed` metric exists but nothing reads it.

**Insight:** We don't want to make logging blocking or throw exceptions — that violates non-blocking. But we should make it harder to silently lose events.

- [ ] Add a configurable `EventLossCallback` functional interface: `void onEventLoss(EventLogEntry event, String reason)`
- [ ] Add builder method: `AsyncEventLogger.Builder.onEventLoss(EventLossCallback)`
- [ ] Default callback: log WARN via SLF4J (current behavior)
- [ ] Invoke callback whenever an event is dropped (queue full + no spillover, spillover queue full, post-shutdown)
- [ ] Ensure `getMetrics()` method (already exists) is well-documented: returns snapshot of `eventsQueued`, `eventsSent`, `eventsFailed`, `eventsSpilled`, `circuitOpen`
- [ ] Add Spring Boot property: `eventlog.async.warn-on-event-loss: true` (default) — auto-config registers a WARN-logging callback
- [ ] Optionally expose metrics via Micrometer if on classpath: `eventlog.events.queued`, `eventlog.events.sent`, `eventlog.events.failed`, `eventlog.events.spilled` gauges

**Files:** `java-sdk/eventlog-sdk/src/main/java/com/eventlog/sdk/client/AsyncEventLogger.java`, `java-sdk/eventlog-spring-boot-starter/src/main/java/com/eventlog/sdk/autoconfigure/EventLogAutoConfiguration.java`, `java-sdk/eventlog-spring-boot-starter/src/main/java/com/eventlog/sdk/autoconfigure/EventLogProperties.java`

---

### 6. [LOW] Upgrade JaCoCo to 0.8.12

**Principles:** Performance (tooling)

**Problem:** JaCoCo 0.8.11 (pinned at `pom.xml:175`) was the first release with Java 21 support but has known issues with virtual thread and record instrumentation. 0.8.12 fixes these. Since the SDK uses virtual threads (`AsyncEventLogger` lines 124-126, 140-141) and records (`EventLogContext`), coverage numbers may be under-reported.

- [ ] Bump JaCoCo version from `0.8.11` to `0.8.12` in `java-sdk/eventlog-sdk/pom.xml`
- [ ] Run tests and verify coverage numbers remain stable (if they increase, the fix was needed)
- [ ] Check if `-Dnet.bytebuddy.experimental=true` surefire argLine (line 130) is still needed

**Files:** `java-sdk/eventlog-sdk/pom.xml`

---

## API

### 1. [HIGH] Fix POST /v1/events array mode — use batch service path

**Principles:** Ease of Use, Performance

**Problem:** `create.ts:29` routes arrays through `Promise.all(events.map(e => eventLogService.createEvent(e)))` — N concurrent individual inserts with no transaction. This causes three issues:

1. **Partial failures persist:** If event 3/5 fails, events 1-2 are already committed. The caller gets an error but has no way to know which succeeded.
2. **No per-item error reporting:** Unlike `POST /batch` which returns `errors[]` with indices, this path returns a single success/failure.
3. **Misleading `correlation_id`:** Response returns `events[0].correlation_id` (line 30) regardless of whether all events share the same correlation ID. Mixed-correlation arrays silently lose all but the first.
4. **No idempotency optimization:** Each `createEvent` does its own individual `SELECT TOP 1` for idempotency. The batch path does a chunked bulk lookup.

**Fix:** Route arrays through the existing `createEvents` batch service method, which already handles transactions, chunking, idempotency, and per-item error reporting.

- [ ] In `create.ts`: when `Array.isArray(events)`, call `eventLogService.createEvents(events)` instead of `Promise.all` of individual calls
- [ ] Update response schema to include `errors` array (matching batch response shape) for per-item failure reporting
- [ ] Return all unique `correlation_ids` from the array instead of just `events[0].correlation_id`
- [ ] Update `createEventResponseSchema` at `events.ts:102-106` to match
- [ ] Add test: array with mixed correlation IDs returns all unique correlation IDs
- [ ] Add test: partial failure in array returns per-item error reporting
- [ ] Preserve single-event path unchanged (non-array still calls `createEvent`)

**Files:** `api/src/routes/events/create.ts`, `api/src/schemas/events.ts`, `api/test/routes/events/create.test.ts`

---

### 2. [HIGH] Remove all Postgres references

**Principles:** Ease of Setup, Ease of Use

**Problem:** Postgres is a fully present but dormant prior implementation. `DATABASE_URL` is **required** in `env.ts:5` (`.min(1)`) but only used by the unused Postgres driver. Every MSSQL deployment must set a fake `DATABASE_URL` or the app crashes on startup. The `pg` package ships to production unnecessarily. The error handler catches Postgres error code `23505` but MSSQL's equivalent codes (2627, 2601) are unhandled — unique constraint violations return a generic 500 instead of a clean 409.

- [ ] Remove `DATABASE_URL` from `env.ts` (or make it `.optional()`)
- [ ] Delete `api/src/db/drivers/postgres.ts`
- [ ] Delete `api/src/db/schema/postgres/` directory
- [ ] Remove `initializeDbPg()` and `dbPg` export from `api/src/db/client.ts`
- [ ] Delete `api/drizzle.postgres.config.ts`
- [ ] Delete `api/drizzle/` directory (postgres migration artifacts)
- [ ] Remove `pg` and `@types/pg` from `package.json` dependencies
- [ ] Remove postgres npm scripts from `package.json` (`db:generate`, `db:migrate`, `db:push`, `db:studio` pointing to postgres config)
- [ ] Update `package.json` description from "PostgreSQL" to "MSSQL"
- [ ] Replace Postgres error code `23505` in `error-handler.ts` with MSSQL equivalents: error number `2627` (unique constraint) → 409, error number `2601` (unique index) → 409
- [ ] Remove `'src/db/schema/postgres/**'` from vitest coverage exclusions
- [ ] Update `.env.example` to show MSSQL variables instead of `DATABASE_URL=postgresql://...`

**Files:** `api/src/config/env.ts`, `api/src/db/client.ts`, `api/src/db/drivers/postgres.ts` (delete), `api/src/db/schema/postgres/` (delete), `api/src/plugins/error-handler.ts`, `api/package.json`, `api/drizzle.postgres.config.ts` (delete), `api/drizzle/` (delete), `api/.env.example`, `api/vitest.config.ts`

---

### 3. [HIGH] Add pagination to correlation and trace endpoints

**Principles:** Performance, Ease of Use

**Problem:** `getByCorrelation` (`event-log.service.ts:245-268`) and `getByTrace` (`event-log.service.ts:271-288`) return all matching rows with no limit. A long-running process or a correlation ID spanning many retries could return hundreds or thousands of events.

**Sizing analysis:** A typical EventLogEntry JSON (all fields populated, no request/response payloads) is ~1-3KB. Industry standard defaults: GitHub 30/100max, Stripe 10/100max, AWS 50-100/1000max. A typical process has 5-20 steps. Even the pet-resort-api's most complex scenario (process retry, scenario 8) produces ~30 events per correlation. A **default of 200, max of 500** captures virtually all processes without needing pagination parameters while providing a safety cap.

- [ ] Add optional `page` and `page_size` query params to `by-correlation.ts` (default page=1, page_size=200, max page_size=500)
- [ ] Add optional `page` and `page_size` query params to `by-trace.ts` (same defaults)
- [ ] Update `getByCorrelation` service method to accept pagination, add `.offset()` and `.fetch()` with a `COUNT(*)` query
- [ ] Update `getByTrace` service method — note: `systemsInvolved` and `totalDurationMs` computations (lines 279-285) currently depend on the full result set. Compute these via SQL aggregation (`COUNT(DISTINCT target_system)`, `DATEDIFF`) instead of in-memory post-processing
- [ ] Update response schemas to include `total_count`, `page`, `page_size`, `has_more`
- [ ] Backward compatible: requests without pagination params get page_size=200 (large enough that existing consumers see no change)
- [ ] Add tests for pagination behavior

**Files:** `api/src/routes/events/by-correlation.ts`, `api/src/routes/events/by-trace.ts`, `api/src/services/event-log.service.ts`, `api/src/schemas/events.ts`, corresponding test files

---

### 4. [MEDIUM] Single-query pagination with COUNT(*) OVER()

**Principles:** Performance

**Problem:** Every paginated endpoint runs 2 queries (3 for `getByBatch`): one `SELECT COUNT(*)` and one `SELECT * ... OFFSET/FETCH`. This doubles DB round-trips for every list request.

**Fix:** MSSQL supports `COUNT(*) OVER()` as a window function that returns the total count alongside each data row, eliminating one round-trip per paginated request.

- [ ] Refactor `getByAccount` to use `COUNT(*) OVER()` as an extra column in the main SELECT
- [ ] Apply same pattern to `searchText` and `getByBatch`
- [ ] Apply to the new paginated `getByCorrelation` and `getByTrace` from item 3
- [ ] Extract a shared pagination helper so all endpoints are consistent
- [ ] If Drizzle's API makes `COUNT(*) OVER()` awkward, use `db.execute(sql\`...\`)` with raw SQL — pragmatism over purity
- [ ] Benchmark before/after on a dataset with 10k+ events to confirm improvement

**Files:** `api/src/services/event-log.service.ts`

---

### 5. [MEDIUM] Make DB pool settings env-configurable

**Principles:** Ease of Setup

**Problem:** All connection pool settings in `mssql.ts:67-78` are hardcoded: `pool.max=10`, `pool.min=0`, `idleTimeoutMillis=30000`, `acquireTimeoutMillis=15000`, `requestTimeout=30000`. Different environments need different tuning.

- [ ] Add env vars to `env.ts`: `DB_POOL_MAX` (default 10), `DB_POOL_MIN` (default 0), `DB_IDLE_TIMEOUT_MS` (default 30000), `DB_ACQUIRE_TIMEOUT_MS` (default 15000), `DB_REQUEST_TIMEOUT_MS` (default 30000), `DB_CONNECT_TIMEOUT_MS` (default 30000)
- [ ] All new vars optional with current values as defaults (zero breaking change)
- [ ] Reference in `mssql.ts` pool config
- [ ] Update `.env.example` with commented-out pool settings

**Files:** `api/src/config/env.ts`, `api/src/db/drivers/mssql.ts`, `api/.env.example`

---

### 6. [MEDIUM] Add DB readiness healthcheck endpoint

**Principles:** Ease of Setup

**Problem:** Current `GET /healthcheck` returns 200 OK without verifying DB connectivity. F5/LB liveness checks are fine with this, but Kubernetes readiness probes and operations teams need to know if the API can actually serve requests.

- [ ] Keep existing `GET /healthcheck` as-is (fast, for F5/LB liveness)
- [ ] Add `GET /healthcheck/ready` that executes `SELECT 1` against MSSQL, returns 200 if successful, 503 if not
- [ ] Response body: `{ status: "ready", database: "connected", timestamp: "..." }` or `{ status: "not_ready", database: "error", error: "..." }`
- [ ] 3-second timeout on the DB query to avoid hanging readiness probes
- [ ] Add tests for both success and DB-down scenarios

**Files:** `api/src/app.ts` (or new route file), `api/src/db/drivers/mssql.ts` (expose `checkConnection` helper)

---

## Pet Resort API (Gold Standard)

*These items depend on Java SDK changes being completed first.*

### 1. [MEDIUM] Update to use new ProcessLogger spanLinks API

**Depends on:** Java SDK item 1

- [ ] Refactor `BookingService.java:253-278` (createBookingHappyPath "Confirm Booking"): replace the 15-line raw `EventLogEntry.builder()` with `processLogger.withSpanLinks(List.of(kennelSpanId, vetSpanId)).logStep(3, "Confirm Booking", ...)`
- [ ] Refactor `BookingService.java:735-749` (checkOut "Release Kennel"): same pattern with `withSpanLinks(List.of(paymentSpanId, invoiceSpanId))`
- [ ] Update inline comments to show this as the recommended fork-join pattern
- [ ] Verify runbook scenarios 1, 4, 8 still produce correct `span_links` in the dashboard

**Files:** `pet-resort-api/src/main/java/com/example/petresort/service/BookingService.java`

---

### 2. [MEDIUM] Update to use per-step targetSystem override

**Depends on:** Java SDK item 3

- [ ] Remove repetitive `processLogger.withTargetSystem("PET_RESORT")` calls before every step in `createBooking` (lines 118, 196, etc.)
- [ ] Use `withTargetSystem()` only before steps that target external systems (KENNEL_VENDOR, VET_CHECK_API, STRIPE, INVENTORY_SERVICE)
- [ ] Add comment: "targetSystem auto-reverts to template default after each step. Only set it when calling an external system."
- [ ] Verify all 10 runbook scenarios tag correct target system on each event

**Files:** `pet-resort-api/src/main/java/com/example/petresort/service/BookingService.java`, `pet-resort-api/src/main/java/com/example/petresort/service/RoomServiceService.java`

---

### 3. [MEDIUM] Demonstrate log() return value handling

**Depends on:** Java SDK item 5

- [ ] In `checkOut()` (Approach 2 — manual builders), capture `asyncEventLogger.log()` return value and log WARN if false
- [ ] In `createBooking()` (Approach 1 — ProcessLogger), no change needed — ProcessLogger handles internally
- [ ] Add comment block explaining three event-loss safety nets: (1) ProcessLogger handles internally, (2) manual `log()` calls should check return, (3) `EventLossCallback` provides application-wide notification

**Files:** `pet-resort-api/src/main/java/com/example/petresort/service/BookingService.java`

---

### 4. [LOW] Remove MDC filter after starter ships it

**Depends on:** Java SDK item 4

- [ ] Delete `EventLogMdcFilter.java` from pet-resort-api
- [ ] Replace `EventLogConfig.java` filter registration with a single property: `eventlog.mdc-filter.url-patterns: "/api/*"`
- [ ] Keep `X-Simulate` MDC population in a separate, tiny pet-resort-specific filter (~10 lines) since the starter won't include demo concerns
- [ ] This demonstrates the "zero filter code" setup story for onboarding teams

**Files:** `pet-resort-api/src/main/java/com/example/petresort/config/EventLogMdcFilter.java` (delete), `pet-resort-api/src/main/java/com/example/petresort/config/EventLogConfig.java` (simplify), `pet-resort-api/src/main/resources/application.yml`

---

## Verification

After all changes:

1. **Java SDK:** `mvn clean test` in `java-sdk/` — all existing + new tests pass, coverage thresholds met
2. **API:** `npm test` in `api/` — all existing + new tests pass, coverage thresholds met
3. **Pet Resort integration:** Start API (`npm run dev`), start pet-resort-api, run `demo-runbook.sh` — all 10 scenarios complete with correct events in dashboard
4. **Pagination:** Query a correlation ID with 200+ events — verify paginated response with `total_count` and `has_more`
5. **Batch sender:** Under load (1000 events/sec from pet-resort), verify SDK sends batched HTTP requests (fewer HTTP calls than events) via API request logs
6. **Postgres removal:** Remove `DATABASE_URL` from `.env`, start API with only MSSQL vars — app starts without error
