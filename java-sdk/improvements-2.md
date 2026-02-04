# Improvements Plan (v2) - java-sdk

## Goals

1. Reduce boilerplate for common logging.
2. Improve configuration validation and discoverability.
3. Clarify or fix misleading helper APIs.

## Plan

1. Auto-configure `EventLogTemplate` in the Spring Boot starter.
2. Add convenience overloads to `EventLogTemplate.ProcessLogger` that default `result` and reduce required params.
3. Clarify or fix `EventLogUtils` helpers so they can produce buildable entries.
4. Improve config validation behavior and documentation.
5. Revisit `@LogEvent` default process handling when blank or missing.

## Step 1: Auto-configure EventLogTemplate

1. Add a `@Bean` for `EventLogTemplate` in `EventLogAutoConfiguration`.
2. Populate `applicationId`, `targetSystem`, `originatingSystem` from `EventLogProperties` and `Environment` in the same way as `LogEventAspect.from`.
3. Allow override by user-provided `EventLogTemplate` bean via `@ConditionalOnMissingBean`.
4. Document in README that `EventLogTemplate` is auto-wired.

## Step 2: Add ProcessLogger Convenience Overloads

1. Add `logStep(String stepName, EventStatus status, String summary)` that defaults `result` to `status.name()`.
2. Add `processEnd(int stepSequence, EventStatus status, String summary)` that defaults `result` to `status.name()` and omits `totalDurationMs`.
3. Add `error(String errorCode, String message)` that defaults `summary` to `message` and `result` to `FAILED`.
4. Keep existing methods intact to avoid breaking changes.
5. Update examples in README to show the shorter calls.

## Step 3: Fix or Clarify EventLogUtils

1. Option A (preferred): add overloads that accept `applicationId`, `targetSystem`, `originatingSystem`, `summary`, `result`.
2. If Option A is chosen, keep current methods and document the new “complete” overloads.

## Step 4: Improve Config Validation

1. Add `spring-boot-starter-validation` as a dependency in the starter (or document it explicitly if you want to keep it optional).
2. Ensure OAuth partial config results in a clear startup error when validation is enabled.
3. Add a short “Validation prerequisites” section to README.

## Step 5: @LogEvent Default Process Handling

1. Treat blank `process()` as “default to class name” (or method name) in `LogEventAspect`.
2. Keep the warning log for visibility, but proceed with logging.
3. Document the default behavior in README and annotation Javadoc.

## Acceptance Criteria

1. A user can inject `EventLogTemplate` without manual construction.
2. Common logging paths no longer require explicit `result` or `eventStatus` boilerplate.
3. `EventLogUtils` does not mislead users into `build()` failures.
4. Invalid config fails fast when validation is present and is clearly documented when not.
5. `@LogEvent` behaves predictably with blank process names.
