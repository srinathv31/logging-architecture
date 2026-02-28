---
title: Getting Started
---

# Getting Started

## Prerequisites

- Node.js 22+
- pnpm
- MSSQL Server (local or remote)

## Setup

```bash
# 1. Install dependencies
cd api && pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MSSQL connection details

# 3. Run database migrations
pnpm db:migrate

# 4. Start the API
pnpm dev   # runs on http://localhost:8080
```

## Verify

- **Health check**: `GET http://localhost:8080/healthcheck`
- **Swagger UI**: [http://localhost:8080/docs](http://localhost:8080/docs)
- **Version**: `GET http://localhost:8080/version`

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DB_SERVER` | MSSQL server hostname |
| `DB_NAME` | Database name |

### Authentication (choose one)

**SQL Auth** (local development):

| Variable | Description |
|----------|-------------|
| `DB_USER` | SQL username |
| `DB_PASSWORD` | SQL password |

**Azure AD MSI** (production):

| Variable | Description |
|----------|-------------|
| `MSI_ENDPOINT` | MSI endpoint URL |
| `MSI_SECRET` | MSI secret |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `NODE_ENV` | `development` | Environment |
| `LOG_LEVEL` | `info` | Pino log level |
| `DRIZZLE_LOG` | `false` | Enable Drizzle query logging |
| `FULLTEXT_ENABLED` | `true` | Enable full-text search |
| `DB_POOL_MAX` | `10` | Max pool connections |
| `DB_POOL_MIN` | `0` | Min pool connections |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Idle connection timeout |

## Running Tests

```bash
pnpm test
```
