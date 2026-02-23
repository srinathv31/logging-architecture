# Event Log Platform

Centralized event logging for distributed systems — capture, correlate, and visualize process flows across services.

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

## Pet Resort Example (Java)

Spring Boot app showcasing all three SDK logging approaches. See [`pet-resort-api/README.md`](pet-resort-api/README.md) for details.

```bash
cd pet-resort-api && mvn spring-boot:run   # starts on :8081
```

## SDKs

- **Java SDK** — [`java-sdk/README.md`](java-sdk/README.md) — Spring Boot auto-configuration, ProcessLogger, @LogEvent annotations
- **Node SDK** — [`node-sdk/README.md`](node-sdk/README.md) — AsyncEventLogger, OAuth, retry with circuit breaker

## Dashboard

The dashboard ([`dashboard/`](dashboard/)) connects directly to MSSQL (no API layer) using Azure AD MSI auth. See the dashboard directory for setup instructions.

## API Documentation

- **Swagger UI** at `/docs` when the API is running
- **Dashboard endpoints** — [`docs/dashboard-api.md`](docs/dashboard-api.md)

## Versioning

Current release: **1.0.0** — see [`CHANGELOG.md`](CHANGELOG.md) for details.
