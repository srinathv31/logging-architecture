---
title: Introduction
---

# Event Log Platform

Centralized event logging for distributed systems — capture, correlate, and visualize process flows across services.

## What is the Event Log Platform?

The Event Log Platform provides a unified way to capture structured events across your microservices architecture. It enables teams to:

- **Track multi-step business processes** across service boundaries
- **Correlate events** by account, trace, or correlation ID
- **Visualize process flows** in the dashboard with timeline and status views
- **Debug failures** with full event history, including request/response payloads
- **Monitor health** with aggregate statistics, success rates, and SLA tracking

## Repository Layout

| Directory         | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `api/`            | Fastify REST API — event ingestion, querying, batch operations            |
| `dashboard/`      | Next.js management UI — trace visualization, event search                 |
| `java-sdk/`       | Java SDK with Spring Boot starter (ProcessLogger, @LogEvent, async queue) |
| `node-sdk/`       | TypeScript/Node.js SDK (AsyncEventLogger, retry, circuit breaker)         |
| `pet-resort-api/` | Spring Boot reference app demonstrating all Java SDK patterns             |
| `docs/`           | Architecture docs, dashboard API spec, feature roadmap                    |

## Prerequisites

- **Node.js 22+** and **pnpm** — for the API and dashboard
- **Java 21+** and **Maven 3.9+** — for the Java SDK and Pet Resort example
- **MSSQL Server** (local or remote) — event storage backend

## Quick Start

```bash
# 1. Install API dependencies
cd api && pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MSSQL connection details

# 3. Run database migrations
pnpm db:migrate

# 4. Start the API
pnpm dev   # runs on http://localhost:8080
```

Swagger UI: [http://localhost:8080/docs](http://localhost:8080/docs)

## SDKs

Choose the SDK for your language:

- **[Java SDK](/java-sdk/)** — Spring Boot auto-configuration, ProcessLogger, @LogEvent annotations
- **[Node SDK](/node-sdk/)** — AsyncEventLogger, OAuth, retry with circuit breaker

## Dashboard

The dashboard connects directly to MSSQL (no API layer) using Azure AD MSI auth. See the [dashboard directory](https://github.com/your-org/event-log-platform/tree/main/dashboard) for setup instructions.

## API Documentation

- **Swagger UI** at `/docs` when the API is running
- **[REST API Reference](/api/)** — full endpoint documentation
