---
title: Route Registration with Prefix Hierarchy
impact: CRITICAL
impactDescription: Incorrect route registration breaks the API URL structure and prevents proper route encapsulation
tags: fastify, routes, registration, prefix
---

## Route Registration with Prefix Hierarchy

Each domain has its own directory under `routes/`. A central `routes/index.ts` imports and registers all domain routes with their prefixes. The top-level `app.ts` registers the combined routes under the `/v1` prefix, producing URLs like `/v1/events`, `/v1/traces`.

**Incorrect (routes registered directly in app.ts, no prefix hierarchy):**

```typescript
// app.ts - DO NOT register routes directly here
import { createEventRoutes } from './routes/events/create';
import { listTracesRoutes } from './routes/traces/list';

const app = fastify();

// Flat registration with hardcoded paths - breaks encapsulation
createEventRoutes(app);
listTracesRoutes(app);
```

**Correct (hierarchical registration via routes/index.ts):**

```typescript
// routes/index.ts
import type { FastifyInstance } from 'fastify';
import { eventRoutes } from './events/index';
import { traceRoutes } from './traces/index';

export async function registerRoutes(app: FastifyInstance) {
  app.register(eventRoutes, { prefix: '/events' });
  app.register(traceRoutes, { prefix: '/traces' });
}
```

```typescript
// app.ts - single registration point with version prefix
app.register(registerRoutes, { prefix: '/v1' });
```

```typescript
// routes/events/index.ts - domain-level aggregation
import type { FastifyInstance } from 'fastify';
import { createEventRoutes } from './create';
import { batchCreateRoutes } from './batch-create';

export async function eventRoutes(app: FastifyInstance) {
  app.register(createEventRoutes);
  app.register(batchCreateRoutes);
}
```

Each domain directory (`events/`, `traces/`) has its own `index.ts` that aggregates sub-routes. This keeps route files small and focused on a single endpoint, while the prefix hierarchy automatically composes the full URL path. Adding a new domain only requires creating a new directory and a single line in `routes/index.ts`.
