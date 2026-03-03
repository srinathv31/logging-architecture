---
title: Environment Variable Validation with Zod
impact: MEDIUM
impactDescription: catches misconfiguration at startup instead of runtime
tags: env, config, zod, validation, fail-fast
---

## Environment Variable Validation with Zod

Define the environment schema with Zod, use `safeParse` on `process.env`, and call `process.exit(1)` on failure with human-readable errors. This fail-fast approach catches misconfiguration at startup rather than at runtime when a request hits a broken code path.

**Incorrect (using process.env directly without validation, missing defaults):**

```typescript
// BAD: no validation, no type safety, runtime errors on missing vars
const port = parseInt(process.env.PORT); // NaN if undefined
const host = process.env.HOST; // possibly undefined
const dbPoolMax = Number(process.env.DB_POOL_MAX); // NaN if undefined

app.listen({ port, host }); // crashes or binds to wrong interface
```

**Correct (Zod schema with safeParse and fail-fast, based on api/src/config/env.ts):**

```typescript
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DB_SERVER: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().optional().default(10),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
```

- `z.coerce.number()` handles automatic string-to-number conversion, which is necessary since all `process.env` values are strings.
- `.default()` provides sensible defaults so the app works out of the box in development.
- `safeParse` + `process.exit(1)` ensures the app fails fast with a clear error message on misconfiguration.
- `result.error.flatten().fieldErrors` produces a human-readable object showing exactly which variables are invalid and why.
- Export the typed `env` object for use throughout the app instead of accessing `process.env` directly.
