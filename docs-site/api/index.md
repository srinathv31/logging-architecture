---
title: REST API
---

# REST API

Fastify-powered event ingestion API with OpenAPI docs, batch operations, and full-text search.

## Tech Stack

- **Fastify v5** with TypeScript
- **Drizzle ORM** for MSSQL database access
- **Zod** for request/response validation (via `fastify-type-provider-zod`)
- **OpenAPI 3.1** auto-generated from Zod schemas
- **Pino** structured logging (Fastify's built-in logger)

## Base URL

All endpoints are prefixed with `/v1`.

```
https://your-eventlog-api.example.com/v1
```

## Swagger UI

Interactive API documentation is available at `/docs` when the API is running.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `LOG_LEVEL` | `info` | Log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `DB_SERVER` | — | MSSQL server hostname |
| `DB_NAME` | — | Database name |
| `DB_USER` | — | SQL auth username (optional — skips Azure AD MSI) |
| `DB_PASSWORD` | — | SQL auth password |

## Server Limits

| Setting | Value |
|---------|-------|
| Request timeout | 30 seconds |
| Body size limit | 1 MB |

## Endpoints

| Section | Endpoints |
|---------|-----------|
| [Events](/api/endpoints/events) | Create, query by account/correlation/trace, text search, lookup |
| [Traces](/api/endpoints/traces) | List traces with aggregate summaries |
| [Dashboard](/api/endpoints/dashboard) | Aggregate statistics |
| [Correlation Links](/api/endpoints/correlation-links) | Create and retrieve correlation-to-account mappings |
| [Batch Operations](/api/endpoints/batch-operations) | Batch create, query, and summarize |
| [Processes](/api/endpoints/processes) | Process definition CRUD |

## Health Checks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthcheck` | Liveness check — returns `{ status: "ok" }` |
| `GET` | `/healthcheck/ready` | Readiness check — verifies database connectivity |
| `GET` | `/version` | Returns API version from `package.json` |
