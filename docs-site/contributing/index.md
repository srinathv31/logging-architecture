---
title: Contributing
---

# Contributing

How to contribute to the Event Log Platform.

## Repository Structure

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `api/` | Fastify + TypeScript | REST API |
| `dashboard/` | Next.js + React | Management UI |
| `java-sdk/` | Java 21 + Maven | Java SDK with Spring Boot starter |
| `node-sdk/` | TypeScript + Node.js | Node/TypeScript SDK |
| `pet-resort-api/` | Spring Boot 3.4 | Reference application |
| `docs/` | Markdown | Architecture docs |

## Local Development Setup

### Prerequisites

- **Node.js 22+** and **pnpm** for the API and dashboard
- **Java 21+** and **Maven 3.9+** for the Java SDK and Pet Resort
- **MSSQL Server** for event storage

### Running the API

```bash
cd api
pnpm install
cp .env.example .env  # edit with your MSSQL connection
pnpm db:migrate
pnpm dev              # http://localhost:8080
```

### Running the Dashboard

```bash
cd dashboard
pnpm install
pnpm dev              # http://localhost:3000
```

### Running the Java SDK Tests

```bash
cd java-sdk
mvn test
```

### Running the Pet Resort Example

```bash
# Ensure API is running first
cd pet-resort-api
mvn spring-boot:run   # http://localhost:8081
```

## Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Run tests (`pnpm test` for API/dashboard, `mvn test` for Java)
4. Open a pull request

See [Branching Strategy](/contributing/branching-strategy) for detailed workflow.

## Code Style

- **API/Dashboard**: ESLint + Prettier (auto-formatted on save)
- **Java SDK**: Standard Java conventions, 4-space indentation
- **Tests**: Vitest for TypeScript, JUnit 5 for Java
