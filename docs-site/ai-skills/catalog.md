# Skills Catalog

All 9 AI skills organized by type. Each section covers what the skill teaches, its rule categories, and when it activates.

## Project-Specific Knowledge

These skills encode patterns unique to the Event Log Platform codebase.

---

### event-log-api

Fastify REST API patterns for the Event Log API. Apply when adding endpoints, modifying services, writing tests, or querying the database in the `api/` directory.

| Property | Value |
|----------|-------|
| **Rules** | 19 |
| **Location** | `.claude/skills/event-log-api/` |
| **Technologies** | Fastify v5, Zod, Drizzle ORM, Vitest |
| **Trigger** | Tasks involving route creation, schema validation, service layer changes, error handling, or test writing in the Fastify API |

#### Rule Categories

| Category | Rules | Priority |
|----------|-------|----------|
| Route Definition | `route-definition`, `route-registration` | High |
| Schema Validation | `schema-zod-validation`, `schema-date-preprocessing`, `schema-enum-patterns`, `schema-pagination`, `schema-cross-field-refinement` | High |
| Service Layer | `service-layer-structure`, `service-chunked-batch-insert`, `service-pagination-window` | High |
| Error Handling | `error-apperror-hierarchy`, `error-handler-plugin`, `error-mssql-constraints` | High |
| Testing | `test-app-factory`, `test-service-mock`, `test-drizzle-mock`, `test-fixture-factory` | Medium |
| API Conventions | `response-format`, `env-zod-config` | Medium |

::: tip Cross-reference
Use alongside [drizzle-core](#drizzle-core) and [drizzle-mssql](#drizzle-mssql) when working on database schema changes in the API.
:::

---

### event-log-java-sdk

Java SDK integration patterns for the Event Log API. Apply when using `EventLogTemplate`, `@LogEvent`, configuring the Spring Boot starter, or troubleshooting SDK issues.

| Property | Value |
|----------|-------|
| **Rules** | 16 |
| **Location** | `.claude/skills/event-log-java-sdk/` |
| **Technologies** | Spring Boot, Java, OAuth 2.0 |
| **Trigger** | Tasks involving Java event logging, ProcessLogger, Spring Boot YAML configuration, OAuth setup, spillover, or circuit breaker configuration |

#### Rule Categories

| Category | Rules | Priority |
|----------|-------|----------|
| EventLogTemplate | `template-process-logger`, `template-one-shot-fields`, `template-error-handling`, `template-mdc-integration` | High |
| @LogEvent Annotation | `annotation-log-event`, `annotation-configuration` | High |
| Spring Boot Config | `config-spring-boot-yaml`, `config-auto-configuration`, `config-transport-selection` | High |
| Authentication | `oauth-setup` | High |
| Advanced Patterns | `fork-join-span-links`, `batch-operations` | Medium |
| Resilience | `resilience-spillover`, `resilience-circuit-breaker` | Medium |
| Testing & Troubleshooting | `test-mock-logger`, `troubleshooting-common-issues` | Medium |

::: tip Cross-reference
Use alongside [configure-java-sdk](#configure-java-sdk) when setting up the SDK in a new Spring Boot application.
:::

## General-Purpose Knowledge

These skills teach library and framework best practices that apply broadly.

---

### drizzle-core

Core Drizzle ORM schema definition patterns and best practices. Reference when defining database schemas, creating tables, setting up relationships, or configuring constraints.

| Property | Value |
|----------|-------|
| **Rules** | 9 |
| **Location** | `.claude/skills/drizzle-core/` |
| **Technologies** | Drizzle ORM, TypeScript |
| **Trigger** | Tasks involving schema design, table creation, foreign keys, indexes, or database modeling |

#### Rule Categories

| Category | Rules | Priority |
|----------|-------|----------|
| Schema Definition | `schema-table-definition`, `schema-column-modifiers`, `schema-default-values` | High |
| Constraints | `schema-primary-keys`, `schema-foreign-keys`, `schema-unique-constraints`, `schema-check-constraints` | High |
| Performance & Relations | `schema-indexes`, `schema-relations` | Medium |

---

### drizzle-mssql

Microsoft SQL Server specific patterns for Drizzle ORM. Use when defining schemas for MSSQL databases, choosing MSSQL data types, or configuring MSSQL-specific features.

| Property | Value |
|----------|-------|
| **Rules** | 10 |
| **Location** | `.claude/skills/drizzle-mssql/` |
| **Technologies** | Drizzle ORM, SQL Server, T-SQL |
| **Trigger** | Tasks involving MSSQL, SQL Server, T-SQL, or when using `drizzle-orm/mssql-core` |

#### Rule Categories

| Category | Rules | Priority |
|----------|-------|----------|
| Data Types | `types-integer`, `types-string`, `types-datetime`, `types-numeric`, `types-binary`, `types-boolean`, `types-uuid` | High |
| Constraints | `constraint-unique-limitations`, `constraint-identity-columns` | High |
| Patterns | `pattern-connection-pool` | Medium |

::: warning Unique Constraint Limitations
Drizzle ORM's MSSQL dialect has known limitations with unique constraints. The `constraint-unique-limitations` rule documents workarounds — review it before adding unique constraints to MSSQL schemas.
:::

---

### shadcn-ui

Shadcn/UI component patterns for Next.js App Router. Apply when building UI components, forms, data tables, or charts using shadcn/ui.

| Property | Value |
|----------|-------|
| **Rules** | 19 |
| **Location** | `.claude/skills/shadcn-ui/` |
| **Technologies** | shadcn/ui, React, Radix UI, Tailwind CSS |
| **Trigger** | Requests for buttons, cards, dialogs, forms, tables, charts, or any UI that shadcn provides |

#### Rule Categories

| Category | Rules | Priority |
|----------|-------|----------|
| CLI | `cli-install-components`, `cli-init-project` | High |
| Composition | `compose-from-primitives`, `compose-compound-patterns` | High |
| Forms | `form-react-hook-form-zod`, `form-field-components` | High |
| Tables | `table-tanstack-setup`, `table-column-definitions`, `table-features` | High |
| Charts | `chart-recharts-setup`, `chart-config-theming`, `chart-types` | Medium |
| Styling | `style-cn-utility`, `style-css-variables` | Medium |
| Next.js | `nextjs-client-server-boundary`, `nextjs-loading-patterns` | Medium |
| Accessibility | `a11y-preserve-radix` | Medium |
| Extension | `extend-variant-customization`, `extend-wrapper-components` | Medium |

---

### typescript-type-safety

TypeScript type inference and safety patterns. Apply when writing code that needs type narrowing, safe indexing, exhaustive checks, or when deciding between explicit annotations and inference.

| Property | Value |
|----------|-------|
| **Rules** | 10 |
| **Location** | `.claude/skills/typescript-type-safety/` |
| **Technologies** | TypeScript |
| **Trigger** | Narrowing logic, switch statements over union types, array/object access, or `tsconfig` strict settings |

#### Rule Categories

| Category | Rules | Priority |
|----------|-------|----------|
| Type Narrowing | `narrow-typeof-guards`, `narrow-instanceof-guards`, `narrow-discriminated-unions`, `narrow-in-operator` | High |
| Inference | `infer-when-to-annotate`, `infer-satisfies-operator`, `infer-const-assertions` | Medium |
| Compiler Config | `config-strict-mode`, `config-unchecked-index-access` | High |
| Safety Utilities | `safety-exhaustive-never` | High |

## Task / Scaffold Skills

These skills guide the AI through multi-step workflows. They don't have individual rule files — all instructions live in `SKILL.md`.

---

### new-api-endpoint

Scaffolds a new Fastify API endpoint with schema, route, service, and registration. Invoked with `/new-api-endpoint`.

| Property | Value |
|----------|-------|
| **Location** | `.claude/skills/new-api-endpoint/` |
| **Technologies** | Fastify, Zod, Drizzle ORM |
| **Trigger** | `/new-api-endpoint` or requests to create a new REST resource in the API |

**Workflow steps:**
1. Create Zod request/response schemas
2. Create service function with Drizzle queries
3. Create route handler with schema validation
4. Register route in the plugin tree

::: info
This skill generates code that follows the patterns documented in [event-log-api](#event-log-api). The reference skill provides the "why" — this scaffold skill provides the "how".
:::

---

### new-api-test

Scaffolds tests for an API route or service with mocks, fixtures, and the test app factory. Invoked with `/new-api-test`.

| Property | Value |
|----------|-------|
| **Location** | `.claude/skills/new-api-test/` |
| **Technologies** | Vitest, Fastify |
| **Trigger** | `/new-api-test` or requests to write tests for an API route or service |

**Workflow steps:**
1. Create route test file with test app factory
2. Create service test file with mocked dependencies
3. Create test fixtures using the factory pattern

::: info
This skill generates tests that follow the patterns documented in the Testing category of [event-log-api](#event-log-api).
:::

---

### configure-java-sdk

Walks through adding the Event Log Java SDK to a Spring Boot application. Invoked with `/configure-java-sdk`.

| Property | Value |
|----------|-------|
| **Location** | `.claude/skills/configure-java-sdk/` |
| **Technologies** | Spring Boot, Maven/Gradle, Java |
| **Trigger** | `/configure-java-sdk` or requests to set up event logging in a Spring Boot app |

**Workflow steps:**
1. Add Maven/Gradle dependency
2. Configure `application.yml` with Event Log properties
3. Create `EventLogTemplate` bean
4. Set up MDC context propagation
5. Verify the integration

::: info
This skill sets up the SDK using the patterns documented in [event-log-java-sdk](#event-log-java-sdk). The reference skill covers advanced usage — this scaffold skill covers initial setup.
:::

## Summary

| Skill | Type | Rules |
|-------|------|------:|
| `event-log-api` | Project-Specific | 19 |
| `event-log-java-sdk` | Project-Specific | 16 |
| `drizzle-core` | General-Purpose | 9 |
| `drizzle-mssql` | General-Purpose | 10 |
| `shadcn-ui` | General-Purpose | 19 |
| `typescript-type-safety` | General-Purpose | 10 |
| `new-api-endpoint` | Task / Scaffold | — |
| `new-api-test` | Task / Scaffold | — |
| `configure-java-sdk` | Task / Scaffold | — |
| **Total** | **9 skills** | **83 rules** |
