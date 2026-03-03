# Event Log API — Project Context

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Fastify v5 + TypeScript + Drizzle ORM (MSSQL) |
| Dashboard | Next.js 16 + React 19 |
| Java SDK | Spring Boot starter for event logging |
| Docs | VitePress |
| Package Manager | pnpm |
| Testing | Vitest (both API and Dashboard) |
| Deployment | Azure App Service (Linux) via Terraform |

## Directory Structure

```
api/            — Fastify REST API (routes, services, schemas, db)
dashboard/      — Next.js UI (fetches data from API, no direct DB access)
docs-site/      — VitePress documentation
```

## Commands

```bash
# API
cd api && pnpm dev      # start dev server
cd api && pnpm test     # run tests

# Dashboard
cd dashboard && pnpm dev
cd dashboard && pnpm test

# Docs
cd docs-site && pnpm dev
```

## Coding Patterns

Domain-specific coding patterns are maintained as skills in `.claude/skills/`.
Copilot and Claude Code load these on-demand — no need to duplicate here.
