---
name: event-log-java-sdk
description: Java SDK integration patterns for the Event Log API. Apply when using EventLogTemplate, @LogEvent, configuring the Spring Boot starter, or troubleshooting SDK issues. Triggers on tasks involving Java event logging, ProcessLogger, Spring Boot YAML configuration, OAuth setup, spillover, or circuit breaker configuration.
license: MIT
metadata:
  author: community
  version: "1.0.0"
---

# Event Log Java SDK Patterns

Comprehensive guide for integrating the Event Log Java SDK into Spring Boot applications. Covers EventLogTemplate, @LogEvent annotation, Spring Boot configuration, OAuth, advanced patterns, resilience, and testing. Contains 16 rules across 7 categories.

## When to Apply

Reference these guidelines when:
- Using `EventLogTemplate` or `ProcessLogger` to log multi-step processes
- Adding `@LogEvent` annotations for automatic method-level logging
- Configuring `application.yml` for the Event Log SDK
- Setting up OAuth client credentials for production
- Implementing fork-join (parallel step) or batch operation patterns
- Configuring spillover or circuit breaker for resilience
- Writing tests with `MockAsyncEventLogger`
- Troubleshooting SDK issues (events not logging, circuit breaker, MDC)

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | EventLogTemplate | CRITICAL | `template-` |
| 2 | @LogEvent Annotation | HIGH/MEDIUM | `annotation-` |
| 3 | Spring Boot Config | CRITICAL/HIGH | `config-` |
| 4 | Authentication | HIGH | `oauth-` |
| 5 | Advanced Patterns | MEDIUM | `fork-join-`/`batch-` |
| 6 | Resilience | HIGH | `resilience-` |
| 7 | Testing & Troubleshooting | MEDIUM | `test-`/`troubleshooting-` |

## Quick Reference

### 1. EventLogTemplate (CRITICAL)

- `template-process-logger` - forProcess() → processStart/logStep/processEnd
- `template-one-shot-fields` - One-shot vs persistent field behavior
- `template-error-handling` - Three-layer: logStep(FAILURE) / processEnd(FAILURE) / error()
- `template-mdc-integration` - MDC auto-propagation of traceId, correlationId

### 2. @LogEvent Annotation (HIGH/MEDIUM)

- `annotation-log-event` - @LogEvent for zero-code method-level logging
- `annotation-configuration` - Annotation attributes, enabling/disabling

### 3. Spring Boot Config (CRITICAL/HIGH)

- `config-spring-boot-yaml` - Complete application.yml reference
- `config-auto-configuration` - Auto-configured beans, transport selection
- `config-transport-selection` - WebClient vs RestClient vs JDK HttpClient

### 4. Authentication (HIGH)

- `oauth-setup` - Client credentials flow, token caching

### 5. Advanced Patterns (MEDIUM)

- `fork-join-span-links` - Parallel step tracking with spanLinks
- `batch-operations` - Bulk event creation with shared batchId

### 6. Resilience (HIGH)

- `resilience-spillover` - Disk spillover for event loss prevention
- `resilience-circuit-breaker` - Circuit breaker config and monitoring

### 7. Testing & Troubleshooting (MEDIUM)

- `test-mock-logger` - MockAsyncEventLogger for test assertions
- `troubleshooting-common-issues` - Checklist for frequent SDK issues

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/template-process-logger.md
rules/config-spring-boot-yaml.md
rules/resilience-spillover.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and variations

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
